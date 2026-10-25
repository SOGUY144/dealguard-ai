"use client";

import Link from "next/link";
import { useActionState, useId } from "react";
import type { FormAction } from "@/lib/auth/form-state";
import { FormMessage, SubmitButton, TextField } from "./fields";
import { WelcomeHandoff } from "./welcome-handoff";

export function SignupForm({ action }: { action: FormAction }) {
  const [state, formAction] = useActionState(action, {});
  const privacyId = useId();
  const privacyError = state.fieldErrors?.privacy;

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      {/* สมัครแล้วได้ session ทันที → คัตซีนต้อนรับแล้วพาเข้าแชต */}
      <WelcomeHandoff welcome={state.welcome} />
      <FormMessage error={state.error} notice={state.notice} />
      <TextField
        label="ชื่อที่ให้ร้านเรียก"
        name="display_name"
        autoComplete="name"
        required
        maxLength={80}
        hint="เช่น คุณนก — ผู้ช่วย AI จะเรียกชื่อนี้ในแชต"
        defaultValue={state.values?.display_name}
        error={state.fieldErrors?.display_name}
      />
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
      <TextField
        label="รหัสผ่าน"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        minLength={8}
        hint="อย่างน้อย 8 ตัวอักษร"
        error={state.fieldErrors?.password}
      />
      <div className="flex flex-col gap-1">
        <div className="flex items-start gap-2.5">
          <input
            id={privacyId}
            name="privacy"
            type="checkbox"
            aria-invalid={privacyError ? true : undefined}
            aria-describedby={privacyError ? `${privacyId}-error` : undefined}
            className="mt-1 size-5 shrink-0 accent-[var(--accent)]"
          />
          <label htmlFor={privacyId} className="text-sm leading-normal">
            ฉันอ่านและยอมรับ
            <Link href="/privacy" target="_blank" className="mx-1 font-semibold text-accent-ink underline">
              นโยบายความเป็นส่วนตัว
            </Link>
            ของร้าน
          </label>
        </div>
        {privacyError && (
          <p id={`${privacyId}-error`} className="pl-7 text-[13px] text-warn-ink">
            {privacyError}
          </p>
        )}
      </div>
      <SubmitButton pendingText="กำลังสมัคร…">สมัครสมาชิก</SubmitButton>
      <p className="text-center text-sm text-muted">
        มีบัญชีแล้ว?{" "}
        <Link href="/login" className="font-semibold text-accent-ink">
          เข้าสู่ระบบ
        </Link>
      </p>
    </form>
  );
}
