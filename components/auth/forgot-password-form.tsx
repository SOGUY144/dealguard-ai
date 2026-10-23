"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { FormAction } from "@/lib/auth/form-state";
import { FormMessage, SubmitButton, TextField } from "./fields";

export function ForgotPasswordForm({ action }: { action: FormAction }) {
  const [state, formAction] = useActionState(action, {});
  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <FormMessage error={state.error} notice={state.notice} />
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
      <SubmitButton pendingText="กำลังส่ง…">ส่งลิงก์ตั้งรหัสผ่านใหม่</SubmitButton>
      <Link href="/login" className="text-center text-sm font-semibold text-accent-ink">
        กลับไปเข้าสู่ระบบ
      </Link>
    </form>
  );
}

export function ResetPasswordForm({ action }: { action: FormAction }) {
  const [state, formAction] = useActionState(action, {});
  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <FormMessage error={state.error} notice={state.notice} />
      <TextField
        label="รหัสผ่านใหม่"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        minLength={8}
        hint="อย่างน้อย 8 ตัวอักษร"
        error={state.fieldErrors?.password}
      />
      <SubmitButton pendingText="กำลังบันทึก…">ตั้งรหัสผ่านใหม่</SubmitButton>
    </form>
  );
}
