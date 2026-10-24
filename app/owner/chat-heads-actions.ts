"use server";

import { getCurrentUser } from "@/lib/auth/dal";
import type { ChatHeadSource } from "@/lib/owner/chat-heads";
import { readChatHeadSources } from "@/lib/owner/chat-heads-read";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * แชตล่าสุดสำหรับหัวแชตลอย (ทุกหน้าเถ้าแก่) — ดึงตอนเปิดหน้าและทุกครั้งที่มีข้อความใหม่
 * ไม่ใช่เถ้าแก่ → [] (ไม่ redirect: เรียกอยู่เบื้องหลัง ห้ามพาออกจากหน้า)
 * อ่านไม่ได้ → null ให้ข้ามรอบนี้ ไม่งั้นรอบถัดไปจะเด้งทุกแชตเป็นของใหม่
 */
export async function chatHeadSources(): Promise<ChatHeadSource[] | null> {
  const user = await getCurrentUser().catch(() => null);
  if (!user) return null;
  if (user.role !== "owner") return [];
  try {
    // อ่านด้วยสิทธิ์ของ owner (RLS)
    return await readChatHeadSources(await createSupabaseServerClient());
  } catch (err) {
    console.error("[owner/chat-heads]", err);
    return null;
  }
}
