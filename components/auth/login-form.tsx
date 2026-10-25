"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useActionState } from "react";
import type { FormAction } from "@/lib/auth/form-state";
import { FormMessage, SubmitButton, TextField } from "./fields";
import { WelcomeHandoff } from "./welcome-handoff";

export function LoginForm({ action }: { action: FormAction }) {
  const [state, formAction] = useActionState(action, {});
  const params = useSearchParams();
  const next = params.get("next") ?? "/";
  // /auth/callback ส่งกลับมาพร้อม ?error=link เมื่อลิงก์ในอีเมลหมดอายุหรือถูกใช้ไปแล้ว
  const linkError = params.get("error") === "link" ? "ลิงก์หมดอายุหรือถูกใช้ไปแล้ว ลองขอลิงก์ใหม่อีกครั้ง" : undefined;

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="next" value={next} />
      {/* ล็อกอินผ่าน → คัตซีนต้อนรับแล้วพาไปหน้าปลายทาง */}
      <WelcomeHandoff welcome={state.welcome} />
      <FormMessage error={state.error ?? linkError} notice={state.notice} />
      <TextField
        label="อีเมล"
        name="email"
        type="email"
        autoComplete="email"
        inputMode="email"
        required
        defaultValue={state.values?.email}
        error={state.fieldErrors?.email}
      />
      <div className="flex flex-col gap-1.5">
        <TextField
          label="รหัสผ่าน"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          error={state.fieldErrors?.password}
        />
        <Link href="/forgot-password" className="self-end text-[13px] font-medium text-accent-ink">
          ลืมรหัสผ่าน?
        </Link>
      </div>
      <SubmitButton pendingText="กำลังเข้าสู่ระบบ…">เข้าสู่ระบบ</SubmitButton>
      <p className="text-center text-sm text-muted">
        ยังไม่มีบัญชี?{" "}
        <Link href="/signup" className="font-semibold text-accent-ink">
          สมัครสมาชิก
        </Link>
      </p>
    </form>
  );
}
