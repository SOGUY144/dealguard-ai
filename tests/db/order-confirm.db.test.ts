// ยืนยันออเดอร์บน Supabase จริง: ลูกค้าปิดดีล → รอยืนยัน → เถ้าแก่กดยืนยัน → ลูกค้าได้ข้อความในแชต + เห็น QR · กดซ้ำไม่ส่งซ้ำ
// รัน: npm run test:db (ต้อง db:migrate ก่อน) — ผู้ใช้ทดสอบถูกลบตอนจบ (แชต/ออเดอร์ลบตามแบบ cascade)
import { randomBytes } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { ChatView } from "@/lib/chat/actions";
import type { ChatMessageOf } from "@/lib/chat/types";
import { readOrder } from "@/lib/chat-server/orders";
import { handleAction, type Buyer, type PipelineDeps } from "@/lib/chat-server/pipeline";
import { SupabaseChatStore } from "@/lib/chat-server/supabase-store";
import { readOrderBoard, readPendingOrders } from "@/lib/owner/dashboard";
import { confirmOrder, orderConfirmedText, setOrderPaid } from "@/lib/owner/payments";

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
const deps = (): PipelineDeps => ({ store: new SupabaseChatStore(admin), storefront, intentLlm: null });

const created: string[] = [];
async function makeUser(role: "buyer" | "owner", displayName: string): Promise<Buyer & { client: SupabaseClient }> {
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
  if (role === "owner") await admin.from("profiles").update({ role: "owner" }).eq("id", data.user.id);
  const client = createClient(url, publishable, { auth: { persistSession: false, autoRefreshToken: false } });
  const signIn = await client.auth.signInWithPassword({ email, password });
  if (signIn.error) throw signIn.error;
  return { id: data.user.id, displayName, client };
}

let buyer: Awaited<ReturnType<typeof makeUser>>;
let owner: Awaited<ReturnType<typeof makeUser>>;

/** ต่อราคาแล้วกดยืนยันข้อจ่ายสด (ไม่หักสต๊อกของแถมของร้านจริง) → id ออเดอร์ใหม่ */
async function closeDeal(text: string): Promise<{ orderId: string; chatId: string }> {
  const view: ChatView = await handleAction(deps(), buyer, { type: "send", text, inputMode: "text" });
  const card = view.messages.findLast((m): m is ChatMessageOf<"offers"> => m.type === "offers")!;
  const cash = card.offers.find((o) => o.lever === "cash")!;
  await handleAction(deps(), buyer, { type: "confirm_offer", messageId: card.id, offerId: cash.id });
  const order = await admin
    .from("orders")
    .select("id, chat_id")
    .eq("buyer_id", buyer.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();
  return { orderId: order.data!.id, chatId: order.data!.chat_id };
}

async function ownerTexts(chatId: string): Promise<string[]> {
  const messages = await new SupabaseChatStore(admin).listMessages(chatId);
  return messages.flatMap((m) => (m.type === "owner_text" ? [m.text] : []));
}

let first: { orderId: string; chatId: string };

beforeAll(async () => {
  [buyer, owner] = await Promise.all([makeUser("buyer", "คุณรอยืนยัน"), makeUser("owner", "เถ้าแก่ยืนยัน")]);
  await handleAction(deps(), buyer, { type: "pick_product", sku: "CBL-C-1M" });
  first = await closeDeal("ขอ 125 ได้ไหม 1000 ชิ้น");
});

afterAll(async () => {
  await Promise.all(created.map((id) => admin.auth.admin.deleteUser(id)));
});

describe("เถ้าแก่ยืนยันออเดอร์", () => {
  it("ลูกค้าปิดดีล → ออเดอร์รอยืนยัน · ขึ้นในรายการแจ้งเตือนของเถ้าแก่", async () => {
    expect((await readOrder(buyer.client, first.orderId))?.confirmedAt).toBeNull();
    const pending = await readPendingOrders(owner.client);
    expect(pending.find((o) => o.id === first.orderId)).toMatchObject({
      chatId: first.chatId,
      buyerName: "คุณรอยืนยัน",
      offer: { lever: "cash", qty: 1000 },
    });
  });

  it("ลูกค้าอ่านรายการรอยืนยันของร้านไม่ได้ (เห็นแค่ออเดอร์ตัวเอง และไม่มีของคนอื่น)", async () => {
    const seen = await readPendingOrders(buyer.client);
    expect(seen.every((o) => o.chatId === first.chatId)).toBe(true);
  });

  it("กดยืนยัน → ลูกค้าเห็นว่ายืนยันแล้ว + ได้ข้อความจากเถ้าแก่ในแชต · หายจากรายการรอยืนยัน", async () => {
    const result = await confirmOrder(admin, first.orderId, "เฮียชัย", new Date("2026-10-25T03:15:00Z"));
    expect(result).toEqual({ ok: true, confirmedAt: "2026-10-25T03:15:00.000Z", first: true });
    expect((await readOrder(buyer.client, first.orderId))?.confirmedAt).toBe("2026-10-25T03:15:00.000Z");
    expect(await ownerTexts(first.chatId)).toEqual([orderConfirmedText("เฮียชัย")]);
    expect((await readPendingOrders(owner.client)).some((o) => o.id === first.orderId)).toBe(false);
  });

  it("กดซ้ำ (หรือสองแท็บพร้อมกัน) → เวลาแรกอยู่ต่อ และไม่ส่งข้อความซ้ำ", async () => {
    const again = await confirmOrder(admin, first.orderId, "เฮียชัย", new Date("2026-10-26T09:00:00Z"));
    expect(again).toEqual({ ok: true, confirmedAt: "2026-10-25T03:15:00.000Z", first: false });
    expect(await ownerTexts(first.chatId)).toHaveLength(1);
  });

  it("แท็บออเดอร์: ยืนยันแล้วอยู่ในรอชำระ", async () => {
    const board = await readOrderBoard(owner.client, new Date("2026-10-25T04:00:00Z"));
    expect(board.awaiting.some((d) => d.id === first.orderId)).toBe(true);
    expect(board.pending.some((d) => d.id === first.orderId)).toBe(false);
  });

  it("ลูกค้าแก้สถานะยืนยันเองไม่ได้ (RLS ไม่มีสิทธิ์เขียน)", async () => {
    await buyer.client.from("orders").update({ confirmed_at: null }).eq("id", first.orderId);
    expect((await readOrder(admin, first.orderId))?.confirmedAt).toBe("2026-10-25T03:15:00.000Z");
  });

  it("ลูกค้าโอนมาก่อน → กดได้รับเงินแล้วกับออเดอร์ที่ยังไม่ยืนยัน = ยืนยันให้ด้วย", async () => {
    const second = await closeDeal("ขอ 125 ได้ไหม 500 ชิ้น");
    const paid = await setOrderPaid(admin, second.orderId, true, new Date("2026-10-25T05:00:00Z"));
    expect(paid).toEqual({ ok: true, paidAt: "2026-10-25T05:00:00.000Z", confirmedAt: "2026-10-25T05:00:00.000Z" });
    expect((await readOrder(buyer.client, second.orderId))?.confirmedAt).toBe("2026-10-25T05:00:00.000Z");
  });

  it("ออเดอร์ที่ไม่มีอยู่ → บอกว่าไม่พบ", async () => {
    expect(await confirmOrder(admin, "00000000-0000-0000-0000-000000000000", "เฮียชัย")).toEqual({
      ok: false,
      error: "ไม่พบออเดอร์นี้",
    });
  });
});
