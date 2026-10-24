// pipeline แชตกับ Supabase จริง: ต่อราคา → ยืนยัน → ออเดอร์ / ส่งเรื่องให้เถ้าแก่ แล้วเช็กว่าลูกค้าอ่านได้แค่ส่วนที่ควรเห็น
// รัน: npm run test:db  (ต้อง db:migrate + db:seed ก่อน) — ผู้ใช้ทดสอบถูกลบตอนจบ (แชต/ออเดอร์ลบตามแบบ cascade)
import { randomBytes } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { ChatView } from "@/lib/chat/actions";
import type { ChatMessage, ChatMessageOf } from "@/lib/chat/types";
import { readOrder } from "@/lib/chat-server/orders";
import { handleAction, loadChat, type Buyer, type PipelineDeps } from "@/lib/chat-server/pipeline";
import { SupabaseChatStore } from "@/lib/chat-server/supabase-store";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const publishable = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const storefront = {
  storeName: "ร้านเฮียชัยโมบาย",
  tagline: "ขายส่ง",
  ownerName: "เฮียชัย",
  assistantName: "ผู้ช่วย AI ของเฮียชัย",
  bankAccountName: "[ชื่อบัญชีร้าน]",
  contactChannel: "[ช่องทางติดต่อของร้าน]",
  orderRefPlaceholder: "[เลขออเดอร์]",
};

const created: string[] = [];

async function makeBuyer(displayName: string): Promise<Buyer & { client: SupabaseClient }> {
  const email = `pipe-${randomBytes(4).toString("hex")}@dealguard.test`;
  const password = randomBytes(12).toString("base64url");
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: displayName, privacy_accepted: true },
  });
  if (error) throw error;
  created.push(data.user.id);
  const client = createClient(url, publishable, { auth: { persistSession: false, autoRefreshToken: false } });
  const signIn = await client.auth.signInWithPassword({ email, password });
  if (signIn.error) throw signIn.error;
  return { id: data.user.id, displayName, client };
}

const last = <T extends ChatMessage["type"]>(view: ChatView, type: T) =>
  view.messages.findLast((m): m is ChatMessageOf<T> => m.type === type);

// ทุก request สร้าง store ใหม่เหมือน API จริง (ไม่มีอะไรค้างในหน่วยความจำ)
const deps = (): PipelineDeps => ({ store: new SupabaseChatStore(admin), storefront, intentLlm: null });

let nok: Awaited<ReturnType<typeof makeBuyer>>;
let other: Awaited<ReturnType<typeof makeBuyer>>;

beforeAll(async () => {
  [nok, other] = await Promise.all([makeBuyer("นก"), makeBuyer("สมชาย")]);
});

afterAll(async () => {
  await Promise.all(created.map((id) => admin.auth.admin.deleteUser(id)));
});

describe("pipeline + Supabase", () => {
  it("เปิดพร้อมกันสองแท็บตอนยังไม่มีแชต → แชตเดียว ทักครั้งเดียว", async () => {
    const fresh = await makeBuyer("สองแท็บ");
    await Promise.all([loadChat(deps(), fresh), loadChat(deps(), fresh), loadChat(deps(), fresh)]);
    const chats = await admin.from("chats").select("id").eq("buyer_id", fresh.id);
    expect(chats.data).toHaveLength(1);
    const greetings = await admin.from("messages").select("id").eq("chat_id", chats.data![0].id);
    expect(greetings.data).toHaveLength(1);
  });

  let offersMsg: ChatMessageOf<"offers">;

  it("ทักทาย → เลือกสินค้า → ต่อราคา ได้ 3 ข้อเสนอ เรียงข้อความถูก และโหลดใหม่ได้เหมือนเดิม", async () => {
    const first = await loadChat(deps(), nok);
    expect(first.messages).toHaveLength(1);

    await handleAction(deps(), nok, { type: "pick_product", sku: "CBL-C-1M" });
    const view = await handleAction(deps(), nok, { type: "send", text: "ขอ 125 ได้ไหม 1000 ชิ้น", inputMode: "voice" });
    offersMsg = last(view, "offers")!;
    expect(offersMsg.offers.map((o) => o.pricePerUnit)).toEqual([130, 135, 145]);
    expect(view.messages.map((m) => m.type)).toEqual([
      "ai_text",
      "product_card",
      "ai_text",
      "buyer_text",
      "ai_text",
      "offers",
    ]);

    const reloaded = await loadChat(deps(), nok);
    expect(reloaded.messages).toEqual(view.messages);
    expect(reloaded.messages[3]).toMatchObject({ type: "buyer_text", inputMode: "voice" });
  });

  it("ข้อความเรียงตามลำดับที่ฐานข้อมูลออกให้ (ไม่ขึ้นกับนาฬิกาของ server) และแชตขยับเวลาล่าสุด", async () => {
    const store = new SupabaseChatStore(admin);
    const chat = (await store.findChat(other.id)) ?? (await store.createChat(other.id, { type: "ai_text", text: "ทัก" }));
    const before = await admin.from("chats").select("updated_at").eq("id", chat.id).single();
    const texts = ["หนึ่ง", "สอง", "สาม", "สี่", "ห้า"];
    await store.appendMessages(chat.id, texts.map((text) => ({ type: "buyer_text", text, inputMode: "text" }) as const));
    const listed = (await store.listMessages(chat.id)).filter((m) => m.type === "buyer_text");
    expect(listed.map((m) => (m.type === "buyer_text" ? m.text : ""))).toEqual(texts);
    const after = await admin.from("chats").select("updated_at").eq("id", chat.id).single();
    expect(Date.parse(after.data!.updated_at) >= Date.parse(before.data!.updated_at)).toBe(true);
  });

  it("ตัวนับการต่อราคาบันทึกแบบ compare-and-set — ค่าเดิมเปลี่ยนไปแล้วต้องไม่ทับ", async () => {
    const store = new SupabaseChatStore(admin);
    const chat = (await store.findChat(other.id))!;
    const zero = { belowFloorCount: 0, injectionCount: 0 };
    expect(await store.setNegotiation(chat.id, zero, { belowFloorCount: 1, injectionCount: 0 })).toBe(true);
    expect(await store.setNegotiation(chat.id, zero, { belowFloorCount: 5, injectionCount: 0 })).toBe(false);
    const row = await admin.from("chat_negotiation").select("below_floor_count").eq("chat_id", chat.id).single();
    expect(row.data!.below_floor_count).toBe(1);
  });

  it("ลูกค้าอ่านข้อความ/ข้อเสนอของตัวเองได้ แต่อ่าน margin ไม่ได้ และคนอื่นอ่านแชตนี้ไม่ได้", async () => {
    const own = await nok.client.from("offers").select("id").eq("message_id", offersMsg.id);
    expect(own.data).toHaveLength(3);
    const economics = await nok.client.from("offer_economics").select("*");
    expect(economics.data).toEqual([]);
    const stranger = await other.client.from("messages").select("id").eq("id", offersMsg.id);
    expect(stranger.data).toEqual([]);
  });

  it("ลูกค้าอ่านตัวนับการต่อราคาไม่ได้ (เดาราคาพื้นไม่ได้) · ตาราง chats ไม่มีคอลัมน์ตัวนับแล้ว", async () => {
    const counters = await nok.client.from("chat_negotiation").select("*");
    expect(counters.data).toEqual([]);
    const legacy = await nok.client.from("chats").select("below_floor_count");
    expect(legacy.error).not.toBeNull();
    const own = await nok.client.from("chats").select("id, mode");
    expect(own.data).toHaveLength(1);
  });

  it("RPC ของ server เรียกจาก browser ไม่ได้", async () => {
    const { error } = await nok.client.rpc("escalate_chat", { p_chat: offersMsg.id, p_kind: "refund", p_brief: ["a", "b", "c"] });
    expect(error).not.toBeNull();
  });

  it("คนอื่นยืนยันข้อเสนอของแชตนี้ไม่ได้", async () => {
    await handleAction(deps(), other, { type: "confirm_offer", messageId: offersMsg.id, offerId: "A" });
    const orders = await admin.from("orders").select("id").eq("buyer_id", other.id);
    expect(orders.data).toEqual([]);
  });

  it("ยืนยันข้อ B → ออเดอร์ผูกกับข้อเสนอที่ server เก็บไว้ · กดซ้ำไม่เกิดออเดอร์ที่สอง", async () => {
    const view = await handleAction(deps(), nok, { type: "confirm_offer", messageId: offersMsg.id, offerId: "B" });
    const summary = last(view, "order_summary")!;
    expect(summary.offer).toMatchObject({ id: "B", pricePerUnit: 135, total: 135_000 });

    const order = await admin.from("orders").select("id, offers(letter, total)").eq("buyer_id", nok.id).single();
    expect(order.data!.id).toBe(summary.orderId);
    expect(order.data!.offers).toMatchObject({ letter: "B", total: 135000 });

    await handleAction(deps(), nok, { type: "confirm_offer", messageId: offersMsg.id, offerId: "B" });
    const count = await admin.from("orders").select("id", { count: "exact", head: true }).eq("buyer_id", nok.id);
    expect(count.count).toBe(1);

    const reloaded = await loadChat(deps(), nok);
    expect(last(reloaded, "offers")).toMatchObject({ confirmed: true, selectedId: "B" });

    // ใช้กู้ใบสรุปเมื่อครั้งก่อนบันทึกไม่ครบ
    const chat = (await new SupabaseChatStore(admin).findChat(nok.id))!;
    const found = await new SupabaseChatStore(admin).findOrderForCard(chat.id, offersMsg.id);
    expect(found).toMatchObject({ orderId: summary.orderId, letter: "B" });
  });

  it("ยืนยันพร้อมกันหลายข้อจากการ์ดเดียว → ออเดอร์เดียว · ข้อ C หักสต๊อกของแถม", async () => {
    const racer = await makeBuyer("สองแท็บพร้อมกัน");
    await handleAction(deps(), racer, { type: "pick_product", sku: "CBL-C-1M" });
    const card = last(
      await handleAction(deps(), racer, { type: "send", text: "ขอ 125 ได้ไหม 1000 ชิ้น", inputMode: "text" }),
      "offers",
    )!;
    const before = await admin.from("dead_stock").select("qty_available").eq("name", "หัวชาร์จ 20W").single();
    await Promise.all(
      (["A", "B", "C"] as const).map((offerId) => handleAction(deps(), racer, { type: "confirm_offer", messageId: card.id, offerId })),
    );
    const orders = await admin.from("orders").select("id, offers(letter)").eq("buyer_id", racer.id);
    expect(orders.data).toHaveLength(1);
    const letter = (orders.data![0].offers as unknown as { letter: string }).letter;
    const after = await admin.from("dead_stock").select("qty_available").eq("name", "หัวชาร์จ 20W").single();
    expect(after.data!.qty_available).toBe(before.data!.qty_available - (letter === "C" ? 200 : 0));
    // คืนสต๊อกให้ข้อมูลเดโมเหมือนเดิม
    await admin.from("dead_stock").update({ qty_available: before.data!.qty_available }).eq("name", "หัวชาร์จ 20W");
  });

  it("หน้าออเดอร์: ลูกค้าอ่านออเดอร์ของตัวเองผ่าน RLS ได้ · คนอื่นอ่านไม่ได้ · id แปลกๆ ได้ null", async () => {
    const order = await admin.from("orders").select("id").eq("buyer_id", nok.id).single();
    const id = order.data!.id as string;
    const own = await readOrder(nok.client, id);
    expect(own).toMatchObject({ id, productName: "สายชาร์จ Type-C 1 เมตร", offer: { id: "B", pricePerUnit: 135, qty: 1000 } });
    expect(await readOrder(other.client, id)).toBeNull();
    expect(await readOrder(nok.client, "not-a-uuid")).toBeNull();
  });

  it("ขอคืนเงิน → escalation ในฐานข้อมูล + แชตเป็นโหมด human (ลูกค้าอ่าน escalation ไม่ได้)", async () => {
    const view = await handleAction(deps(), nok, { type: "send", text: "ของเสีย 50 ชิ้น ขอคืนเงิน", inputMode: "text" });
    expect(view.mode).toBe("human");

    const chat = await admin.from("chats").select("id, mode").eq("buyer_id", nok.id).single();
    expect(chat.data!.mode).toBe("human");
    const esc = await admin.from("escalations").select("kind, brief").eq("chat_id", chat.data!.id);
    expect(esc.data).toEqual([expect.objectContaining({ kind: "refund" })]);
    expect(esc.data![0].brief).toHaveLength(3);

    const asBuyer = await nok.client.from("escalations").select("*");
    expect(asBuyer.data).toEqual([]);
  });

  it("เถ้าแก่ปิด AI สินค้านี้ (ai_enabled = false) → ไม่อยู่ในรายการ และ Deal Engine ไม่ต่อราคา", async () => {
    await admin.from("products").update({ ai_enabled: false }).eq("sku", "CBL-C-1M");
    try {
      const config = await new SupabaseChatStore(admin).loadConfig();
      expect(config.products.map((p) => p.sku)).not.toContain("CBL-C-1M");
    } finally {
      await admin.from("products").update({ ai_enabled: true }).eq("sku", "CBL-C-1M");
    }
  });

  it("เถ้าแก่เปลี่ยนชื่อของแถมหลังเสนอแล้ว → ยังสั่งข้อ C ได้ และหักสต๊อกถูกแถว (ใช้ sku)", async () => {
    const renamer = await makeBuyer("เปลี่ยนชื่อของแถม");
    await handleAction(deps(), renamer, { type: "pick_product", sku: "CBL-C-1M" });
    const card = last(
      await handleAction(deps(), renamer, { type: "send", text: "ขอ 125 ได้ไหม 1000 ชิ้น", inputMode: "text" }),
      "offers",
    )!;
    const before = await admin.from("dead_stock").select("name, qty_available").eq("sku", "ADP-20W").single();
    await admin.from("dead_stock").update({ name: "หัวชาร์จ 20W (ชื่อใหม่)" }).eq("sku", "ADP-20W");
    try {
      const view = await handleAction(deps(), renamer, { type: "confirm_offer", messageId: card.id, offerId: "C" });
      expect(view.notice).toBeUndefined();
      const after = await admin.from("dead_stock").select("qty_available").eq("sku", "ADP-20W").single();
      expect(after.data!.qty_available).toBe(before.data!.qty_available - 200);
    } finally {
      await admin
        .from("dead_stock")
        .update({ name: before.data!.name, qty_available: before.data!.qty_available })
        .eq("sku", "ADP-20W");
    }
  });
  describe("ปิดของแถมหลังเสนอแล้ว (รีวิวรอบ 3 · migration 0011)", () => {
    async function giftCard(name: string) {
      const buyer = await makeBuyer(name);
      await handleAction(deps(), buyer, { type: "pick_product", sku: "CBL-C-1M" });
      const view = await handleAction(deps(), buyer, { type: "send", text: "ขอ 125 ได้ไหม 1000 ชิ้น", inputMode: "text" });
      const card = last(view, "offers")!;
      const gift = card.offers.find((o) => o.lever === "bundle")!;
      expect(gift).toBeDefined();
      return { buyer, view, card, gift };
    }
    const stock = async () => (await admin.from("dead_stock").select("qty_available").eq("sku", "ADP-20W").single()).data!.qty_available;

    it("ลูกค้ากดยืนยันข้อรับของแถม → ยืนยันไม่ได้ ไม่มีออเดอร์ ไม่หักสต๊อก", async () => {
      const { buyer, card, gift } = await giftCard("ปิดของแถม-กดยืนยัน");
      const before = await stock();
      await admin.from("dead_stock").update({ gift_enabled: false }).eq("sku", "ADP-20W");
      try {
        const view = await handleAction(deps(), buyer, { type: "confirm_offer", messageId: card.id, offerId: gift.id });
        expect(view.notice).toBe("confirm_unavailable");
        expect((await admin.from("orders").select("id").eq("buyer_id", buyer.id)).data).toEqual([]);
        expect(await stock()).toBe(before);
      } finally {
        await admin.from("dead_stock").update({ gift_enabled: true }).eq("sku", "ADP-20W");
      }
    });

    it("ฐานข้อมูลปฏิเสธเองด้วย แม้ข้ามการตรวจในโค้ด (เรียก place_order ตรง)", async () => {
      const { buyer, view, card, gift } = await giftCard("ปิดของแถม-ด่านสอง");
      const stored = await new SupabaseChatStore(admin).findOffer(view.chatId!, card.id, gift.id);
      const before = await stock();
      await admin.from("dead_stock").update({ gift_enabled: false }).eq("sku", "ADP-20W");
      try {
        const { data, error } = await admin.rpc("place_order", {
          p_chat: view.chatId,
          p_buyer: buyer.id,
          p_offer: stored!.rowId,
          p_offer_message: card.id,
          p_product_name: "สายชาร์จ Type-C 1 เมตร",
          p_gift_sku: "ADP-20W",
          p_gift_name: gift.bundle!.name,
          p_gift_qty: gift.bundle!.qty,
        });
        expect(data).toBeNull();
        expect(error?.message).toMatch(/gift_out_of_stock/);
        expect((await admin.from("orders").select("id").eq("buyer_id", buyer.id)).data).toEqual([]);
        expect(await stock()).toBe(before);
      } finally {
        await admin.from("dead_stock").update({ gift_enabled: true }).eq("sku", "ADP-20W");
      }
    });
  });
});

