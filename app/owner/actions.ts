"use server";

import { z } from "zod";
import { requireOwner } from "@/lib/auth/dal";
import { setOrderPaid, type PaidResult } from "@/lib/owner/payments";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const FAILED: PaidResult = { ok: false, error: "บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง" };

/** "ได้รับเงินแล้ว" / ยกเลิก — ลูกค้าเห็นสถานะใหม่ในใบสรุปทันที (Realtime) */
export async function markOrderPaid(orderId: unknown, paid: unknown): Promise<PaidResult> {
  await requireOwner();
  const id = z.uuid().safeParse(orderId);
  const flag = z.boolean().safeParse(paid);
  if (!id.success || !flag.success) return { ok: false, error: "ข้อมูลไม่ครบ ลองโหลดหน้าใหม่" };
  try {
    return await setOrderPaid(createSupabaseAdminClient(), id.data, flag.data);
  } catch (err) {
    console.error("[owner/payments]", err);
    return FAILED;
  }
}
