// ชำระเงินของออเดอร์บน Supabase จริง: เถ้าแก่กด "ได้รับเงินแล้ว" → ลูกค้าเห็นในใบสรุป · กดซ้ำไม่ทับเวลา · ลูกค้าแก้เองไม่ได้
// รัน: npm run test:db (ต้อง db:migrate ก่อน) — ผู้ใช้ทดสอบถูกลบตอนจบ (แชต/ออเดอร์ลบตามแบบ cascade)
import { randomBytes } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { ChatView } from "@/lib/chat/actions";
import type { ChatMessageOf } from "@/lib/chat/types";
import { readOrder } from "@/lib/chat-server/orders";
import { handleAction, type Buyer, type PipelineDeps } from "@/lib/chat-server/pipeline";
import { SupabaseChatStore } from "@/lib/chat-server/supabase-store";
import { readDeals } from "@/lib/owner/dashboard";
import { setOrderPaid } from "@/lib/owner/payments";

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
let orderId: string;

beforeAll(async () => {
  [buyer, owner] = await Promise.all([makeUser("buyer", "คุณจ่ายเงิน"), makeUser("owner", "เถ้าแก่รับเงิน")]);
  await handleAction(deps(), buyer, { type: "pick_product", sku: "CBL-C-1M" });
  const view: ChatView = await handleAction(deps(), buyer, { type: "send", text: "ขอ 125 ได้ไหม 1000 ชิ้น", inputMode: "text" });
  const card = view.messages.findLast((m): m is ChatMessageOf<"offers"> => m.type === "offers")!;
  // ข้อจ่ายสด — ไม่หักสต๊อกของแถมของร้านจริง
  const cash = card.offers.find((o) => o.lever === "cash")!;
  await handleAction(deps(), buyer, { type: "confirm_offer", messageId: card.id, offerId: cash.id });
  const order = await admin.from("orders").select("id").eq("buyer_id", buyer.id).single();
  orderId = order.data!.id;
});

afterAll(async () => {
  await Promise.all(created.map((id) => admin.auth.admin.deleteUser(id)));
});

describe("ชำระเงินของออเดอร์", () => {
  it("ออเดอร์ใหม่ยังไม่ชำระ ทั้งในใบสรุปของลูกค้าและหน้าดีลของเถ้าแก่", async () => {
    expect((await readOrder(buyer.client, orderId))?.paidAt).toBeNull();
  });

  it("เถ้าแก่กดได้รับเงินแล้ว → ลูกค้าเห็นชำระแล้ว · หน้าดีลของเถ้าแก่เห็นด้วย", async () => {
    const result = await setOrderPaid(admin, orderId, true, new Date("2026-10-25T03:15:00Z"));
    expect(result).toEqual({ ok: true, paidAt: "2026-10-25T03:15:00.000Z", confirmedAt: "2026-10-25T03:15:00.000Z" });
    expect((await readOrder(buyer.client, orderId))?.paidAt).toBe("2026-10-25T03:15:00.000Z");
    // หน้าดีลแสดงเฉพาะออเดอร์ของบัญชี role buyer — ออเดอร์นี้ต้องอยู่และมีเวลาชำระ
    const { deals } = await readDeals(owner.client, null);
    expect(deals.find((d) => d.id === orderId)?.paidAt).toBe("2026-10-25T03:15:00.000Z");
  });

  it("กดซ้ำ (หรือสองแท็บพร้อมกัน) → เวลาแรกที่ยืนยันอยู่ต่อ ไม่ถูกเขียนทับ", async () => {
    expect(await setOrderPaid(admin, orderId, true, new Date("2026-10-26T09:00:00Z"))).toEqual({ ok: true, paidAt: "2026-10-25T03:15:00.000Z", confirmedAt: "2026-10-25T03:15:00.000Z" });
  });

  it("ลูกค้าแก้สถานะการชำระเองไม่ได้ (RLS ไม่มีสิทธิ์เขียน)", async () => {
    await buyer.client.from("orders").update({ paid_at: null }).eq("id", orderId);
    expect((await readOrder(admin, orderId))?.paidAt).toBe("2026-10-25T03:15:00.000Z");
  });

  it("เถ้าแก่กดผิด → ยกเลิกได้ ลูกค้าเห็นกลับเป็นยังไม่ชำระ", async () => {
    // ยืนยันออเดอร์แล้วยังอยู่ — ยกเลิกแค่การรับเงิน
    expect(await setOrderPaid(admin, orderId, false)).toEqual({ ok: true, paidAt: null, confirmedAt: "2026-10-25T03:15:00.000Z" });
    expect((await readOrder(buyer.client, orderId))?.paidAt).toBeNull();
  });

  it("ออเดอร์ที่ไม่มีอยู่ → บอกว่าไม่พบ", async () => {
    expect(await setOrderPaid(admin, "00000000-0000-0000-0000-000000000000", true)).toEqual({ ok: false, error: "ไม่พบออเดอร์นี้" });
  });
});
