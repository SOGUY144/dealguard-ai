"use server";

import { redirect } from "next/navigation";
import type { FormState } from "@/lib/auth/form-state";
import { authErrorMessage, parseLogin, parseSignup } from "@/lib/auth/forms";
import { landingPath, safeNextPath } from "@/lib/auth/routes";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * โดเมนของเว็บสำหรับทำลิงก์ในอีเมล — ใช้ค่าตายตัวจาก env ห้ามอ่านจาก header ของ request
 * (Origin / Host / x-forwarded-host ปลอมได้ → ลิงก์รีเซ็ตรหัสพาไปเว็บคนอื่น)
 */
function siteOrigin(): string {
  const url = process.env.SITE_URL;
  if (url) return url.replace(/\/+$/, "");
  if (process.env.NODE_ENV === "production") throw new Error("ยังไม่ได้ตั้ง SITE_URL");
  return "http://localhost:3000";
}

export async function login(_prev: FormState, form: FormData): Promise<FormState> {
  const parsed = parseLogin(form);
  const values = { email: String(form.get("email") ?? "") };
  if (!parsed.ok) return { fieldErrors: parsed.fieldErrors, values };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: authErrorMessage(error), values };

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", data.user.id).single();
  redirect(landingPath(profile?.role ?? "buyer", safeNextPath(String(form.get("next") ?? "/"))));
}

export async function signup(_prev: FormState, form: FormData): Promise<FormState> {
  const parsed = parseSignup(form);
  const values = { display_name: String(form.get("display_name") ?? ""), email: String(form.get("email") ?? "") };
  if (!parsed.ok) return { fieldErrors: parsed.fieldErrors, values };

  const { displayName, email, password } = parsed.data;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // trigger handle_new_user อ่าน 2 ค่านี้ไปสร้าง profile (role = buyer เสมอ · ไม่ยอมรับนโยบาย = สมัครไม่ได้)
      data: { display_name: displayName, privacy_accepted: true },
      emailRedirectTo: `${siteOrigin()}/auth/callback?next=/`,
    },
  });
  if (error) return { error: authErrorMessage(error), values };

  // ปิดยืนยันอีเมลไว้ (ทีมตัดสินใจ) → ได้ session เลย
  // หมายเหตุ: ตอนปิดยืนยันอีเมล อีเมลซ้ำจะได้ error user_already_exists ซึ่งเผยว่ามีบัญชีนี้
  // ทีมยอมรับไว้เพื่อให้ลูกค้ารู้ว่าต้องไปเข้าสู่ระบบแทน
  if (data.session) redirect("/");
  // เปิดยืนยันอีเมลไว้: ต้องเปิดลิงก์ในอีเมลก่อน
  return { notice: `ส่งลิงก์ยืนยันไปที่ ${email} แล้ว เปิดลิงก์ในอีเมลเพื่อเริ่มใช้งาน`, values };
}

export async function requestPasswordReset(_prev: FormState, form: FormData): Promise<FormState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  if (!email.includes("@")) return { fieldErrors: { email: "อีเมลไม่ถูกต้อง" }, values: { email } };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteOrigin()}/auth/callback?next=/reset-password`,
  });
  // ลองบ่อยเกินไปเป็นเรื่องเดียวที่บอกได้โดยไม่เผยว่ามีบัญชีไหม
  if (error?.code === "over_email_send_rate_limit") return { error: authErrorMessage(error), values: { email } };
  // ข้อความเดียวทุกกรณี (มี/ไม่มีบัญชี, อีเมลฟรีส่งหาคนนอกทีมไม่ได้) — ไม่เผยว่าอีเมลไหนมีบัญชี
  // แต่บอกทางออกไว้ เพราะอีเมลฟรีของ Supabase ส่งได้เฉพาะสมาชิกทีม
  return {
    notice: "ถ้ามีบัญชีของอีเมลนี้ เราส่งลิงก์ตั้งรหัสผ่านใหม่ไปแล้ว ถ้าไม่ได้รับภายใน 5 นาที ติดต่อร้านเพื่อให้ช่วยตั้งรหัสใหม่",
    values: { email },
  };
}

export async function updatePassword(_prev: FormState, form: FormData): Promise<FormState> {
  const password = String(form.get("password") ?? "");
  if (password.length < 8) return { fieldErrors: { password: "รหัสผ่านอย่างน้อย 8 ตัวอักษร" } };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: authErrorMessage(error) };
  redirect("/");
}
