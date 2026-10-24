// หน้าเถ้าแก่อ่านข้อมูลจริงผ่าน RLS: owner เห็นดีล + margin + เรื่องที่ส่งต่อ · ลูกค้าไม่เห็น margin/escalation
// รัน: npm run test:db (ต้อง db:migrate + db:seed ก่อน) — ผู้ใช้ทดสอบถูกลบตอนจบ
import { randomBytes } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { ChatMessageOf } from "@/lib/chat/types";
import { handleAction, type PipelineDeps } from "@/lib/chat-server/pipeline";
import { SupabaseChatStore } from "@/lib/chat-server/supabase-store";
import { countOpenEscalations, readOwnerData } from "@/lib/owner/dashboard";
import { setOrderPaid } from "@/lib/owner/payments";
import { summarize } from "@/lib/owner/summary";

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
async function makeUser(role: "buyer" | "owner", displayName: string) {
  const email = `owner-${randomBytes(4).toString("hex")}@dealguard.test`;
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

let owner: { client: SupabaseClient };
let ownerId: string;
let buyer: Awaited<ReturnType<typeof makeUser>>;
let orderId: string;

beforeAll(async () => {
  const [o, b] = await Promise.all([makeUser("owner", "เถ้าแก่ทดสอบ"), makeUser("buyer", "คุณแดชบอร์ด")]);
  [owner, buyer, ownerId] = [o, b, o.id];
  await handleAction(deps(), buyer, { type: "pick_product", sku: "CBL-C-1M" });
  const offered = await handleAction(deps(), buyer, { type: "send", text: "ขอ 125 ได้ไหม 1000 ชิ้น", inputMode: "text" });
  const offers = offered.messages.findLast((m): m is ChatMessageOf<"offers"> => m.type === "offers")!;
  const confirmed = await handleAction(deps(), buyer, { type: "confirm_offer", messageId: offers.id, offerId: "A" });
  orderId = confirmed.messages.findLast((m): m is ChatMessageOf<"order_summary"> => m.type === "order_summary")!.orderId;
  await handleAction(deps(), buyer, { type: "send", text: "ของเสีย 50 ชิ้น ขอคืนเงิน", inputMode: "text" });
});

afterAll(async () => {
  await Promise.all(created.map((id) => admin.auth.admin.deleteUser(id)));
});

describe("readOwnerData", () => {
  it("ลูกค้ากดยืนยันแล้ว แต่ร้านยังไม่ได้รับเงิน → ยังไม่นับเป็นรายได้ในหน้าภาพรวม · นับเป็นออเดอร์ที่รออยู่", async () => {
    const { deals, openOrders } = await readOwnerData(owner.client);
    expect(deals.some((d) => d.id === orderId)).toBe(false);
    expect(openOrders.pending).toBeGreaterThanOrEqual(1);
  });

  it("เถ้าแก่กดได้รับเงินแล้ว → ดีลเข้าหน้าภาพรวมพร้อมกำไรที่รักษาไว้ตามสูตร SKILL (ข้อ A = +฿20,000)", async () => {
    await setOrderPaid(admin, orderId, true);
    const { deals } = await readOwnerData(owner.client);
    const mine = deals.find((d) => d.id === orderId)!;
    expect(mine).toMatchObject({
      buyerName: "คุณแดชบอร์ด",
      productName: "สายชาร์จ Type-C 1 เมตร",
      offer: { id: "A", pricePerUnit: 130, qty: 1500, total: 195_000 },
      marginIfConceded: 25_000,
      marginOffer: 45_000,
      recoveredMargin: 20_000,
    });
    expect(summarize([mine])).toEqual({ recoveredTotal: 20_000, revenueTotal: 195_000, dealCount: 1 });
  });

  it("owner เห็นเรื่องที่รอตัดสิน (ขอคืนเงิน) พร้อม Deal Brief", async () => {
    const { escalations } = await readOwnerData(owner.client);
    const chat = await admin.from("chats").select("id").eq("buyer_id", buyer.id).single();
    const refund = escalations.find((e) => e.chatId === chat.data!.id)!;
    expect(refund.kind).toBe("refund");
    expect(refund.brief).toHaveLength(3);
  });

  it("แชตที่กำลังคุย: แชตของลูกค้าวันนี้ พร้อมสถานะและข้อความล่าสุด (ไม่รวมแชตของบัญชีเถ้าแก่)", async () => {
    const { activeChats } = await readOwnerData(owner.client);
    const chat = await admin.from("chats").select("id").eq("buyer_id", buyer.id).single();
    const mine = activeChats.find((c) => c.chatId === chat.data!.id)!;
    expect(mine).toMatchObject({ buyerName: "คุณแดชบอร์ด", status: "owner" });
    expect(mine.preview).toContain("ส่งเรื่องให้เถ้าแก่");
    expect(activeChats.some((c) => c.buyerName === "เถ้าแก่ทดสอบ")).toBe(false);
  });

  it("ลูกค้าเรียกได้ แต่ไม่เห็น margin ไม่เห็นเรื่องที่ส่งต่อ", async () => {
    const asBuyer = await readOwnerData(buyer.client);
    expect(asBuyer.deals).toEqual([]);
    expect(asBuyer.escalations).toEqual([]);
    // อ่านได้แค่แชตของตัวเอง (RLS) — ไม่เห็นของคนอื่น
    expect(asBuyer.activeChats.every((c) => c.buyerName === "คุณแดชบอร์ด")).toBe(true);
  });

  it("ออเดอร์ที่บัญชีเถ้าแก่สั่งเอง (ลองหน้าลูกค้า) ไม่นับเป็นดีลของ AI", async () => {
    const ownerAsBuyer = { id: ownerId, displayName: "เถ้าแก่ทดสอบ" };
    await handleAction(deps(), ownerAsBuyer, { type: "pick_product", sku: "CBL-C-1M" });
    const offered = await handleAction(deps(), ownerAsBuyer, { type: "send", text: "ขอ 125 ได้ไหม 1000 ชิ้น", inputMode: "text" });
    const card = offered.messages.findLast((m): m is ChatMessageOf<"offers"> => m.type === "offers")!;
    await handleAction(deps(), ownerAsBuyer, { type: "confirm_offer", messageId: card.id, offerId: "B" });
    const { deals } = await readOwnerData(owner.client);
    expect(deals.some((d) => d.buyerName === "เถ้าแก่ทดสอบ")).toBe(false);
  });

  it("นับเรื่องรอตัดสินตามจริง (ไม่ติดเพดานรายการ) · เรื่องที่ยังไม่ปิดค้างข้ามวันยังอยู่ (รีวิวรอบ 3)", async () => {
    const { escalations, openCount } = await readOwnerData(owner.client);
    expect(openCount).toBeGreaterThanOrEqual(escalations.length);
    const tomorrow = new Date(Date.now() + 36 * 60 * 60 * 1000);
    const later = await readOwnerData(owner.client, tomorrow);
    expect(later.escalations.find((e) => e.kind === "refund" && e.brief[0].includes("คุณแดชบอร์ด"))).toBeDefined();
    expect(await countOpenEscalations(owner.client, tomorrow)).toBe(later.openCount);
  });

  it("ได้รับเงินก่อนวันนี้ (เวลาไทย) ไม่นับเป็นรายได้วันนี้", async () => {
    const tomorrow = new Date(Date.now() + 36 * 60 * 60 * 1000);
    const { deals } = await readOwnerData(owner.client, tomorrow);
    expect(deals.find((d) => d.id === orderId)).toBeUndefined();
  });
});
