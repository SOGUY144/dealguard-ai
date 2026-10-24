// บทสนทนาเต็มกับ Supabase จริง: ต่อราคา → ลูกค้าปฏิเสธทีละทาง → ส่งเถ้าแก่ → เถ้าแก่อนุมัติราคา → ลูกค้ายืนยัน → ออเดอร์
// รัน: npm run test:db -- tests/db/owner-approval.db.test.ts · ผู้ใช้ทดสอบถูกลบตอนจบ (แชต/ข้อเสนอ/ออเดอร์ลบตามแบบ cascade)
// ออเดอร์ในไฟล์นี้ไม่มีของแถม จึงไม่แตะสต๊อกของค้าง
import { randomBytes } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { fallbackIntent } from "@/lib/ai/fallback-intent";
import type { ChatView } from "@/lib/chat/actions";
import type { ChatMessage, ChatMessageOf } from "@/lib/chat/types";
import { readOrder } from "@/lib/chat-server/orders";
import { ownerAction } from "@/lib/chat-server/owner-actions";
import { handleAction, toPublicProducts, type Buyer, type PipelineDeps } from "@/lib/chat-server/pipeline";
import { SupabaseChatStore } from "@/lib/chat-server/supabase-store";
import { buildAssist } from "@/lib/owner/assist";

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
  const email = `approve-${randomBytes(4).toString("hex")}@dealguard.test`;
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

const deps = (): PipelineDeps => ({ store: new SupabaseChatStore(admin), storefront, intentLlm: null });
const last = <T extends ChatMessage["type"]>(view: ChatView, type: T) =>
  view.messages.findLast((m): m is ChatMessageOf<T> => m.type === type);
const levers = (view: ChatView) => last(view, "offers")?.offers.map((o) => o.lever) ?? [];

let ann: Awaited<ReturnType<typeof makeBuyer>>;
let chatId: string;

beforeAll(async () => {
  ann = await makeBuyer("แอน");
});

afterAll(async () => {
  await Promise.all(created.map((id) => admin.auth.admin.deleteUser(id)));
});

describe("AI เจรจา เถ้าแก่แค่ตัดสิน — Supabase จริง", () => {
  const say = (text: string) => handleAction(deps(), ann, { type: "send", text, inputMode: "text" });

  it("ลูกค้าปฏิเสธทีละทาง → ไม่เสนอซ้ำ → ไม่เหลือทาง ส่งเถ้าแก่ (เก็บเป็น buyer_request พร้อมกำไรถ้ายอม)", async () => {
    await handleAction(deps(), ann, { type: "pick_product", sku: "CBL-C-1M" });
    const first = await say("ขอ 125 ได้ไหม 1000 ชิ้น");
    expect(levers(first)).toContain("volume");

    const noMore = await say("ไม่ซื้อเพิ่มครับ");
    expect(levers(noMore)).not.toContain("volume");
    expect(levers(noMore).length).toBeGreaterThan(0);

    const noGift = await say("ไม่เอาของแถม");
    expect(levers(noGift)).not.toContain("volume");
    expect(levers(noGift)).not.toContain("bundle");

    const done = await say("ไม่จ่ายสด ขอ 125 เท่านั้น");
    expect(done.mode).toBe("human");
    expect(done.messages.at(-1)).toMatchObject({ type: "handoff" });
    if (!done.chatId) throw new Error("ไม่มี chatId หลังส่งเถ้าแก่");
    chatId = done.chatId;

    const esc = await admin.from("escalations").select("kind, brief, status").eq("chat_id", chatId).order("created_at").limit(1).single();
    expect(esc.data).toMatchObject({ kind: "buyer_request", status: "open" });
    expect(esc.data!.brief[0]).toContain("ไม่รับทุกทางเลือก");
    expect(esc.data!.brief[2]).toContain("ถ้ายอม ฿125 ได้กำไร");
  });

  it("เถ้าแก่อนุมัติราคา → การ์ดข้อเสนอบันทึกในตาราง offers + margin · ปิดเรื่อง · AI กลับมาดูแลแชต", async () => {
    await ownerAction(new SupabaseChatStore(admin), chatId, {
      type: "approve_price",
      sku: "CBL-C-1M",
      pricePerUnit: 125,
      qty: 1000,
      creditDays: 7,
    });
    const chat = await admin.from("chats").select("mode").eq("id", chatId).single();
    expect(chat.data!.mode).toBe("ai");
    const open = await admin.from("escalations").select("id").eq("chat_id", chatId).eq("status", "open");
    expect(open.data).toEqual([]);
    const offer = await admin
      .from("offers")
      .select("id, lever, label, price_per_unit, qty, total, credit_days, offer_economics(margin_offer)")
      .eq("chat_id", chatId)
      .eq("label", "ราคาที่เถ้าแก่อนุมัติ")
      .single();
    expect(offer.error).toBeNull();
    expect(offer.data).toMatchObject({ lever: "list", qty: 1000, credit_days: 7 });
    expect(Number(offer.data!.price_per_unit)).toBe(125);
  });

  it("ลูกค้ากดยืนยันการ์ดที่เถ้าแก่อนุมัติ → ออเดอร์ · ลูกค้าเปิดใบสรุปได้ · อ่าน margin ไม่ได้", async () => {
    const messages = (await new SupabaseChatStore(admin).listMessages(chatId)).filter((m) => m.type === "offers");
    const card = messages.at(-1)!;
    const view = await handleAction(deps(), ann, { type: "confirm_offer", messageId: card.id, offerId: "A" });
    expect(view.notice).toBeUndefined();
    const summary = last(view, "order_summary")!;
    expect(summary.offer).toMatchObject({ pricePerUnit: 125, qty: 1000, total: 125_000, creditDays: 7 });

    const order = await readOrder(ann.client, summary.orderId);
    expect(order?.offer).toMatchObject({ label: "ราคาที่เถ้าแก่อนุมัติ", creditDays: 7 });
    const economics = await ann.client.from("offer_economics").select("*");
    expect(economics.data).toEqual([]);
  });

  it("ผู้ช่วยตอบ LINE ใช้การตั้งค่าจริงของร้านได้ (ไม่บันทึกอะไร)", async () => {
    const config = await new SupabaseChatStore(admin).loadConfig();
    const products = toPublicProducts(config);
    const text = "ขอ 125 ได้ไหม 1000 ชิ้น";
    const result = buildAssist(config, fallbackIntent(text, { products, lastSku: "CBL-C-1M" }), text, {
      buyerName: "แอน",
      products,
      storefront,
    });
    expect(result.offers.length).toBeGreaterThan(0);
    expect(result.replyText).toContain("สนใจข้อไหนตอบกลับมาได้เลยครับ");
  });
});
