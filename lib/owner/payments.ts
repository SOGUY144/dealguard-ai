// เถ้าแก่ยืนยันออเดอร์ / ยืนยันว่าได้รับเงินแล้ว (หรือยกเลิกถ้ากดผิด) — เรียกจาก server action หลังเช็กว่าเป็นเถ้าแก่แล้ว
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SupabaseChatStore } from "@/lib/chat-server/supabase-store";

export type PaidResult = { ok: true; paidAt: string | null; confirmedAt: string | null } | { ok: false; error: string };
/** first = ครั้งนี้เป็นการยืนยันครั้งแรก (กดซ้ำ / สองแท็บ → false) */
export type ConfirmResult = { ok: true; confirmedAt: string; first: boolean } | { ok: false; error: string };

const NOT_FOUND = { ok: false as const, error: "ไม่พบออเดอร์นี้" };
const iso = (v: unknown) => (v ? new Date(String(v)).toISOString() : null);

/** ข้อความในชื่อเถ้าแก่ที่ลูกค้าได้ในแชตตอนยืนยันออเดอร์ — QR อยู่ในใบสรุปออเดอร์ */
export function orderConfirmedText(ownerName: string): string {
  return `${ownerName}ยืนยันออเดอร์แล้วครับ กด "ดูใบสรุปออเดอร์" เพื่อดู QR ชำระเงินได้เลยครับ`;
}

/**
 * ยืนยันออเดอร์ → ลูกค้าเห็น QR ในใบสรุป + ได้ข้อความจากเถ้าแก่ในแชต (ครั้งแรกเท่านั้น)
 * ไม่เปลี่ยนโหมดแชต — AI ยังตอบคำถามอื่นของลูกค้าต่อได้
 */
export async function confirmOrder(admin: SupabaseClient, orderId: string, ownerName: string, now = new Date()): Promise<ConfirmResult> {
  // กดซ้ำ / สองแท็บกดพร้อมกัน → แถวถูกเขียนครั้งเดียว ข้อความจึงส่งครั้งเดียว
  const updated = await admin
    .from("orders")
    .update({ confirmed_at: now.toISOString() })
    .eq("id", orderId)
    .is("confirmed_at", null)
    .select("chat_id");
  if (updated.error) throw new Error(`[owner] ยืนยันออเดอร์: ${updated.error.message}`);
  const chatId = updated.data[0]?.chat_id as string | undefined;
  if (chatId) {
    try {
      await new SupabaseChatStore(admin).appendMessages(chatId, [{ type: "owner_text", text: orderConfirmedText(ownerName) }]);
    } catch (err) {
      // ออเดอร์ยืนยันแล้ว ใบสรุปของลูกค้าเปลี่ยนเอง — ข้อความในแชตส่งไม่ได้ไม่ควรทำให้เถ้าแก่ต้องกดใหม่
      console.error("[owner] ส่งข้อความยืนยันออเดอร์", err);
    }
  }
  const row = await admin.from("orders").select("confirmed_at").eq("id", orderId).maybeSingle();
  if (row.error) throw new Error(`[owner] อ่านออเดอร์: ${row.error.message}`);
  if (!row.data?.confirmed_at) return NOT_FOUND;
  return { ok: true, confirmedAt: iso(row.data.confirmed_at)!, first: !!chatId };
}

export async function setOrderPaid(admin: SupabaseClient, orderId: string, paid: boolean, now = new Date()): Promise<PaidResult> {
  if (paid) {
    // ได้รับเงินแล้ว = ยืนยันออเดอร์แล้วด้วย (ลูกค้าโอนเข้าบัญชีร้านก่อนเถ้าแก่กดยืนยัน)
    const confirmed = await admin.from("orders").update({ confirmed_at: now.toISOString() }).eq("id", orderId).is("confirmed_at", null);
    if (confirmed.error) throw new Error(`[owner] ยืนยันออเดอร์: ${confirmed.error.message}`);
  }
  // กดซ้ำ / สองแท็บกดพร้อมกัน → เวลาแรกที่ยืนยันอยู่ต่อ ไม่ถูกเขียนทับ · ยกเลิกแค่การรับเงิน ออเดอร์ยังยืนยันอยู่
  const query = paid
    ? admin.from("orders").update({ paid_at: now.toISOString() }).eq("id", orderId).is("paid_at", null)
    : admin.from("orders").update({ paid_at: null }).eq("id", orderId);
  const { error } = await query;
  if (error) throw new Error(`[owner] บันทึกการชำระเงิน: ${error.message}`);
  const row = await admin.from("orders").select("paid_at, confirmed_at").eq("id", orderId).maybeSingle();
  if (row.error) throw new Error(`[owner] อ่านการชำระเงิน: ${row.error.message}`);
  if (!row.data) return NOT_FOUND;
  return { ok: true, paidAt: iso(row.data.paid_at), confirmedAt: iso(row.data.confirmed_at) };
}
