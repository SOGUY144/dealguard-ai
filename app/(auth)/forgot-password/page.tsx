import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { storefront } from "@/lib/config/storefront";
import { requestPasswordReset } from "../actions";

export const metadata: Metadata = { title: `ลืมรหัสผ่าน — ${storefront.storeName}` };

export default function ForgotPasswordPage() {
  return (
    <AuthShell storeName={storefront.storeName} title="ลืมรหัสผ่าน" subtitle="กรอกอีเมลที่ใช้สมัคร เราจะส่งลิงก์ตั้งรหัสผ่านใหม่ให้">
      <ForgotPasswordForm action={requestPasswordReset} />
    </AuthShell>
  );
}
