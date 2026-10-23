// จำกัดจำนวนครั้ง (ล็อกอิน / สมัคร / ขอลิงก์รหัสผ่าน / ส่งข้อความ) — นับใน Postgres
// ต้องนับเองเพราะคำขอทั้งหมดไป Supabase จาก server ของเรา Supabase จึงเห็น IP เดียวกันหมด
// ตั้งหลวมพอให้คนทั้งห้อง (กรรมการใช้ wifi ของงาน = IP เดียวกัน) ใช้ได้ แต่กันยิงรัวๆ
import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const LIMITS = {
  loginPerIp: { windowSeconds: 5 * 60, max: 60 },
  /** นับเฉพาะครั้งที่รหัสผิด และแยกตาม IP — คนอื่นใส่รหัสผิดรัวๆ ล็อกบัญชีเถ้าแก่ที่อื่นไม่ได้ */
  loginFailuresPerEmailIp: { windowSeconds: 15 * 60, max: 10 },
  signupPerIp: { windowSeconds: 60 * 60, max: 30 },
  resetPerIp: { windowSeconds: 60 * 60, max: 10 },
  chatPerUser: { windowSeconds: 60, max: 30 },
} as const;

export type Limit = (typeof LIMITS)[keyof typeof LIMITS];

/** นับไม่ได้ (ฐานข้อมูลสะดุด) → ปล่อยผ่าน: ระบบนับพังไม่ควรทำให้ลูกค้าใช้งานไม่ได้ */
async function rpc<T>(name: string, args: Record<string, unknown>, fallback: T): Promise<T> {
  try {
    const { data, error } = await createSupabaseAdminClient().rpc(name, args);
    if (error) throw error;
    return (data ?? fallback) as T;
  } catch (err) {
    console.warn(`[rate-limit] ${name} ไม่สำเร็จ ปล่อยผ่าน: ${err instanceof Error ? err.message : err}`);
    return fallback;
  }
}

/** นับครั้งนี้ แล้วบอกว่ายังไม่เกินไหม (true = ผ่าน) */
export function allow(key: string, limit: Limit): Promise<boolean> {
  return rpc("hit_rate_limit", { p_key: key, p_window_seconds: limit.windowSeconds, p_max: limit.max }, true);
}

/** ดูอย่างเดียว ไม่นับ (true = ยังไม่เกิน) */
export function notExceeded(key: string, limit: Limit): Promise<boolean> {
  return rpc("check_rate_limit", { p_key: key, p_window_seconds: limit.windowSeconds, p_max: limit.max }, true);
}

/** นับเพิ่ม 1 ครั้ง (เช่น ล็อกอินผิด) */
export async function record(key: string): Promise<void> {
  await rpc("record_rate_hit", { p_key: key }, null);
}

export const TOO_MANY_TRIES = "ลองหลายครั้งเกินไป รอสักครู่แล้วลองใหม่";
