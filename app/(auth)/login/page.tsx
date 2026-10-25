import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";
import { demoBuyer } from "@/lib/config/demo-account";
import { storefront } from "@/lib/config/storefront";
import { login } from "../actions";

export const metadata: Metadata = { title: `เข้าสู่ระบบ — ${storefront.storeName}` };

export default function LoginPage() {
  return (
    <AuthShell storeName={storefront.storeName} title="เข้าสู่ระบบ" subtitle="เข้าสู่ระบบเพื่อแชตต่อราคากับผู้ช่วย AI ของร้าน">
      {/* LoginForm อ่าน ?next= จาก URL จึงต้องอยู่ใน Suspense */}
      <Suspense>
        <LoginForm action={login} demoAccount={demoBuyer} />
      </Suspense>
    </AuthShell>
  );
}
