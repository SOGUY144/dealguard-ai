import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { SignupForm } from "@/components/auth/signup-form";
import { storefront } from "@/lib/config/storefront";
import { signup } from "../actions";

export const metadata: Metadata = { title: `สมัครสมาชิก — ${storefront.storeName}` };

export default function SignupPage() {
  return (
    <AuthShell storeName={storefront.storeName} title="สมัครสมาชิก" subtitle="สมัครครั้งเดียว แล้วต่อราคาได้ทุกสินค้าในร้าน">
      <SignupForm action={signup} />
    </AuthShell>
  );
}
