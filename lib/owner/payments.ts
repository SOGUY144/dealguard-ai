// เถ้าแก่ยืนยันว่าได้รับเงินของออเดอร์แล้ว (หรือยกเลิกถ้ากดผิด) — เรียกจาก server action หลังเช็กว่าเป็นเถ้าแก่แล้ว
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export type PaidResult = { ok: true; paidAt: string | null } | { ok: false; error: string };

export async function setOrderPaid(admin: SupabaseClient, orderId: string, paid: boolean, now = new Date()): Promise<PaidResult> {
  // กดซ้ำ / สองแท็บกดพร้อมกัน → เวลาแรกที่ยืนยันอยู่ต่อ ไม่ถูกเขียนทับ
  const query = paid
    ? admin.from("orders").update({ paid_at: now.toISOString() }).eq("id", orderId).is("paid_at", null)
    : admin.from("orders").update({ paid_at: null }).eq("id", orderId);
  const { error } = await query;
  if (error) throw new Error(`[owner] บันทึกการชำระเงิน: ${error.message}`);
  const row = await admin.from("orders").select("paid_at").eq("id", orderId).maybeSingle();
  if (row.error) throw new Error(`[owner] อ่านการชำระเงิน: ${row.error.message}`);
  if (!row.data) return { ok: false, error: "ไม่พบออเดอร์นี้" };
  return { ok: true, paidAt: row.data.paid_at ? new Date(String(row.data.paid_at)).toISOString() : null };
}
