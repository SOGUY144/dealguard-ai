// Data Access Layer: ตรวจ session + role จริงทุกหน้า/route (proxy.ts เป็นแค่การเช็กเบื้องต้น)
import "server-only";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type CurrentUser = {
  id: string;
  email: string;
  role: "owner" | "buyer";
  displayName: string;
};

/** claims จาก JWT ที่ลายเซ็นถูกต้อง (ยังไม่รู้ว่าบัญชียังอยู่ไหม) · null = ไม่มี session */
const getSessionClaims = cache(async () => {
  // บอก Next ว่าส่วนนี้สร้างตอนมี request เท่านั้น — Supabase เทียบวันหมดอายุ token ด้วย Date.now()
  // ถ้าไม่มี Cache Components จะ error "encountered Date.now() while prerendering"
  await connection();
  const supabase = await createSupabaseServerClient();
  // getClaims ตรวจลายเซ็น JWT — อย่าเชื่อ getSession() ที่อ่านจาก cookie ตรงๆ
  const { data } = await supabase.auth.getClaims();
  return data?.claims?.sub ? data.claims : null;
});

/** null = ยังไม่ล็อกอิน (หรือบัญชีถูกลบไปแล้ว) · cache ไว้ต่อ 1 request ให้เรียกได้หลายที่ */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const claims = await getSessionClaims();
  if (!claims) return null;
  const supabase = await createSupabaseServerClient();

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role, display_name")
    .eq("id", claims.sub)
    .maybeSingle();
  // อ่านไม่ได้ ≠ ไม่มีบัญชี — โยน error ให้หน้าแสดงว่าขัดข้อง ไม่พาไปล้าง session
  if (error) throw new Error(`อ่านบัญชีไม่สำเร็จ: ${error.message}`);
  if (!profile) return null;

  return {
    id: claims.sub,
    email: typeof claims.email === "string" ? claims.email : "",
    role: profile.role,
    displayName: profile.display_name,
  };
});

export async function requireUser(next = "/"): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (user) return user;
  // JWT ยังไม่หมดอายุแต่ไม่มีบัญชีแล้ว (ถูกลบ) → ต้องล้าง session ก่อน
  // ไม่งั้น proxy เห็นว่าล็อกอินอยู่ ส่ง /login กลับมา / แล้ววนไม่จบ
  const next_ = encodeURIComponent(next);
  redirect((await getSessionClaims()) ? `/auth/session-reset?next=${next_}` : `/login?next=${next_}`);
}

/** หน้าเถ้าแก่: buyer เปิดไม่ได้ (เห็นต้นทุน/ราคาพื้น) */
export async function requireOwner(): Promise<CurrentUser> {
  const user = await requireUser("/owner");
  if (user.role !== "owner") redirect("/");
  return user;
}
