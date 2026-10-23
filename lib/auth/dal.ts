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

/** null = ยังไม่ล็อกอิน · cache ไว้ต่อ 1 request ให้เรียกได้หลายที่ */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  // บอก Next ว่าส่วนนี้สร้างตอนมี request เท่านั้น — Supabase เทียบวันหมดอายุ token ด้วย Date.now()
  // ถ้าไม่มี Cache Components จะ error "encountered Date.now() while prerendering"
  await connection();
  const supabase = await createSupabaseServerClient();
  // getClaims ตรวจลายเซ็น JWT — อย่าเชื่อ getSession() ที่อ่านจาก cookie ตรงๆ
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, display_name")
    .eq("id", claims.sub)
    .single();
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
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  return user;
}

/** หน้าเถ้าแก่: buyer เปิดไม่ได้ (เห็นต้นทุน/ราคาพื้น) */
export async function requireOwner(): Promise<CurrentUser> {
  const user = await requireUser("/owner");
  if (user.role !== "owner") redirect("/");
  return user;
}
