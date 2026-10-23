import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { ResetPasswordForm } from "@/components/auth/forgot-password-form";
import { storefront } from "@/lib/config/storefront";
import { updatePassword } from "../actions";

export const metadata: Metadata = { title: `ตั้งรหัสผ่านใหม่ — ${storefront.storeName}` };

// เข้าได้เมื่อมี session จากลิงก์ในอีเมลเท่านั้น (proxy.ts ส่งคนที่ไม่มี session ไปหน้าล็อกอิน)
export default function ResetPasswordPage() {
  return (
    <AuthShell storeName={storefront.storeName} title="ตั้งรหัสผ่านใหม่">
      <ResetPasswordForm action={updatePassword} />
    </AuthShell>
  );
}
