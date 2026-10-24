"use server";

import { z } from "zod";
import { getCurrentUser, requireOwner } from "@/lib/auth/dal";
import { storefront } from "@/lib/config/storefront";
import { readPendingOrders } from "@/lib/owner/dashboard";
import { confirmOrder as confirmOrderRow, setOrderPaid, type PaidResult } from "@/lib/owner/payments";
import type { PendingOrder } from "@/lib/owner/summary";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const FAILED = { ok: false as const, error: "บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง" };
const BAD_INPUT = { ok: false as const, error: "ข้อมูลไม่ครบ ลองโหลดหน้าใหม่" };

/** "ยืนยันออเดอร์" — ลูกค้าเห็น QR ในใบสรุป + ได้ข้อความจากเถ้าแก่ในแชตทันที (Realtime) */
export async function confirmOrder(orderId: unknown): Promise<{ ok: true; confirmedAt: string } | { ok: false; error: string }> {
  await requireOwner();
  const id = z.uuid().safeParse(orderId);
  if (!id.success) return BAD_INPUT;
  try {
    const result = await confirmOrderRow(createSupabaseAdminClient(), id.data, storefront.ownerName);
    return result.ok ? { ok: true, confirmedAt: result.confirmedAt } : result;
  } catch (err) {
    console.error("[owner/orders]", err);
    return FAILED;
  }
}

/** "ได้รับเงินแล้ว" / ยกเลิก — ลูกค้าเห็นสถานะใหม่ในใบสรุปทันที (Realtime) · ยังไม่ยืนยัน = ยืนยันให้ด้วย */
export async function markOrderPaid(orderId: unknown, paid: unknown): Promise<PaidResult> {
  await requireOwner();
  const id = z.uuid().safeParse(orderId);
  const flag = z.boolean().safeParse(paid);
  if (!id.success || !flag.success) return BAD_INPUT;
  try {
    const admin = createSupabaseAdminClient();
    // ผ่านขั้นยืนยันก่อน ลูกค้าจะได้ข้อความในแชตเหมือนกดยืนยันเอง (ยืนยันแล้ว = ไม่ทำอะไร)
    if (flag.data) await confirmOrderRow(admin, id.data, storefront.ownerName);
    return await setOrderPaid(admin, id.data, flag.data);
  } catch (err) {
    console.error("[owner/payments]", err);
    return FAILED;
  }
}

/**
 * ออเดอร์ที่รอเถ้าแก่ยืนยัน — การแจ้งเตือนที่อยู่ทุกหน้าเถ้าแก่ดึงตอนมีออเดอร์ใหม่
 * ไม่ใช่เถ้าแก่ → [] (ไม่ redirect: ตัวแจ้งเตือนเรียกเองอยู่เบื้องหลัง ห้ามพาออกจากหน้า)
 * อ่านไม่ได้ → null ให้ข้ามรอบนี้ ไม่งั้นรอบถัดไปจะเด้งออเดอร์ที่ค้างอยู่ทั้งหมดเป็นของใหม่
 */
export async function pendingOrderAlerts(): Promise<PendingOrder[] | null> {
  const user = await getCurrentUser().catch(() => null);
  if (!user) return null;
  if (user.role !== "owner") return [];
  try {
    // อ่านด้วยสิทธิ์ของ owner (RLS)
    return await readPendingOrders(await createSupabaseServerClient());
  } catch (err) {
    console.error("[owner/orders]", err);
    return null;
  }
}
