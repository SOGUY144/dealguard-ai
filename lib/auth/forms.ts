// ตรวจฟอร์มสมัคร/ล็อกอินฝั่ง server และแปล error ของ Supabase Auth เป็นภาษาไทย
import { z } from "zod";

type Parsed<T, F extends string> = { ok: true; data: T } | { ok: false; fieldErrors: Partial<Record<F, string>> };

const email = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: "อีเมลไม่ถูกต้อง" }));

const signupSchema = z.object({
  display_name: z.string().trim().min(1, { error: "กรอกชื่อที่ให้ร้านเรียก" }).max(80, { error: "ชื่อยาวเกินไป" }),
  email,
  password: z.string().min(8, { error: "รหัสผ่านอย่างน้อย 8 ตัวอักษร" }).max(72, { error: "รหัสผ่านยาวเกินไป" }),
  privacy: z.literal("on", { error: "ต้องยอมรับนโยบายความเป็นส่วนตัวก่อนสมัคร" }),
});

const loginSchema = z.object({
  email,
  password: z.string().min(1, { error: "กรอกรหัสผ่าน" }),
});

function fieldErrors<F extends string>(error: z.ZodError): Partial<Record<F, string>> {
  const out: Partial<Record<F, string>> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0]) as F;
    out[key] ??= issue.message;
  }
  return out;
}

function fromForm(form: FormData, keys: string[]) {
  return Object.fromEntries(keys.map((k) => [k, form.get(k) ?? undefined]));
}

export type SignupField = "display_name" | "email" | "password" | "privacy";

export function parseSignup(
  form: FormData,
): Parsed<{ displayName: string; email: string; password: string }, SignupField> {
  const result = signupSchema.safeParse(fromForm(form, ["display_name", "email", "password", "privacy"]));
  if (!result.success) return { ok: false, fieldErrors: fieldErrors<SignupField>(result.error) };
  const { display_name, email, password } = result.data;
  return { ok: true, data: { displayName: display_name, email, password } };
}

export type LoginField = "email" | "password";

export function parseLogin(form: FormData): Parsed<{ email: string; password: string }, LoginField> {
  const result = loginSchema.safeParse(fromForm(form, ["email", "password"]));
  if (!result.success) return { ok: false, fieldErrors: fieldErrors<LoginField>(result.error) };
  return { ok: true, data: result.data };
}

const MESSAGES: Record<string, string> = {
  invalid_credentials: "อีเมลหรือรหัสผ่านไม่ถูกต้อง",
  email_not_confirmed: "ยังไม่ได้ยืนยันอีเมล — เปิดลิงก์ในอีเมลที่ส่งไปก่อนนะครับ",
  user_already_exists: "อีเมลนี้สมัครไว้แล้ว ลองเข้าสู่ระบบแทน",
  email_exists: "อีเมลนี้สมัครไว้แล้ว ลองเข้าสู่ระบบแทน",
  over_email_send_rate_limit: "ส่งอีเมลบ่อยเกินไป รอสักครู่แล้วลองใหม่",
  over_request_rate_limit: "ลองบ่อยเกินไป รอสักครู่แล้วลองใหม่",
  weak_password: "รหัสผ่านง่ายเกินไป ลองตั้งให้ยาวขึ้น",
  same_password: "รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสเดิม",
  // อีเมลฟรีของ Supabase ส่งได้เฉพาะอีเมลของสมาชิกทีมในโปรเจกต์
  email_address_not_authorized: "ตอนนี้ระบบยังส่งอีเมลไปที่อีเมลนี้ไม่ได้ ติดต่อร้านเพื่อขอความช่วยเหลือ",
  email_address_invalid: "อีเมลนี้รับอีเมลไม่ได้ ตรวจสอบอีเมลอีกครั้ง",
};

/** ไม่ส่งข้อความดิบของระบบไปให้ผู้ใช้ — ข้อความที่ไม่รู้จักใช้ข้อความกลาง */
export function authErrorMessage(error: { code?: string; message?: string } | null | undefined): string {
  return (error?.code && MESSAGES[error.code]) || "มีบางอย่างผิดพลาด ลองใหม่อีกครั้ง";
}
