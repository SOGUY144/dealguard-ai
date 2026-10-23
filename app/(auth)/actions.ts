"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { FormState } from "@/lib/auth/form-state";
import { authErrorMessage, parseLogin, parseSignup } from "@/lib/auth/forms";
import { landingPath, safeNextPath } from "@/lib/auth/routes";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** origin ของเว็บที่ผู้ใช้เปิดอยู่ ใช้ทำลิงก์ในอีเมล (localhost ตอน dev, โดเมน Vercel ตอน deploy) */
async function siteOrigin(): Promise<string> {
  const h = await headers();
  const origin = h.get("origin");
  if (origin) return origin;
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
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
      // trigger handle_new_user อ่าน 2 ค่านี้ไปสร้าง profile (role = buyer เสมอ)
      data: { display_name: displayName, privacy_accepted_at: new Date().toISOString() },
      emailRedirectTo: `${await siteOrigin()}/auth/callback?next=/`,
    },
  });
  if (error) return { error: authErrorMessage(error), values };

  // ปิดยืนยันอีเมลไว้ → ได้ session เลย
  if (data.session) redirect("/");
  // อีเมลซ้ำ Supabase ก็ตอบแบบนี้ (กันเดาว่ามีบัญชีไหม) จึงใช้ข้อความเดียวกัน
  return { notice: `ส่งลิงก์ยืนยันไปที่ ${email} แล้ว เปิดลิงก์ในอีเมลเพื่อเริ่มใช้งาน`, values };
}

export async function requestPasswordReset(_prev: FormState, form: FormData): Promise<FormState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  if (!email.includes("@")) return { fieldErrors: { email: "อีเมลไม่ถูกต้อง" }, values: { email } };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${await siteOrigin()}/auth/callback?next=/reset-password`,
  });
  // ส่งไม่ได้จริง (อีเมลฟรีของ Supabase ส่งได้เฉพาะคนในทีม / อีเมลรับไม่ได้) → บอกตรงๆ ไม่หลอกว่าส่งแล้ว
  const undeliverable = ["over_email_send_rate_limit", "email_address_not_authorized", "email_address_invalid"];
  if (error?.code && undeliverable.includes(error.code)) return { error: authErrorMessage(error), values: { email } };
  // นอกนั้นไม่บอกว่ามีบัญชีนี้หรือไม่
  return { notice: "ถ้ามีบัญชีของอีเมลนี้ เราส่งลิงก์ตั้งรหัสผ่านใหม่ไปแล้ว", values: { email } };
}

export async function updatePassword(_prev: FormState, form: FormData): Promise<FormState> {
  const password = String(form.get("password") ?? "");
  if (password.length < 8) return { fieldErrors: { password: "รหัสผ่านอย่างน้อย 8 ตัวอักษร" } };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: authErrorMessage(error) };
  redirect("/");
}
