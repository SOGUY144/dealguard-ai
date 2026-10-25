"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useActionState, type MouseEvent } from "react";
import { buttonClass } from "@/components/ui/button";
import type { FormAction } from "@/lib/auth/form-state";
import { FormMessage, SubmitButton, TextField } from "./fields";
import { WelcomeHandoff } from "./welcome-handoff";

type DemoAccount = { label: string; note: string; email: string; password: string };

/** บัญชีทดลองให้กรรมการ — กดแล้วกรอกให้ ไม่ต้องพิมพ์เอง */
function DemoAccounts({ accounts }: { accounts: DemoAccount[] }) {
  const fill = (e: MouseEvent<HTMLButtonElement>, { email, password }: DemoAccount) => {
    const fields = e.currentTarget.form?.elements;
    for (const [name, value] of [["email", email], ["password", password]] as const) {
      const input = fields?.namedItem(name) as HTMLInputElement | null;
      if (input) input.value = value;
    }
  };
  return (
    <div role="note" className="flex flex-col gap-3 rounded-2xl bg-accent-tint p-4 text-sm text-accent-ink">
      <p className="font-semibold">บัญชีทดลองสำหรับกรรมการ</p>
      {accounts.map((account) => (
        <div key={account.email} className="flex flex-col gap-2 border-t border-accent-border pt-3 first-of-type:border-0 first-of-type:pt-0">
          <p>
            <span className="font-semibold">{account.label}</span> · {account.note}
          </p>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
            <dt>อีเมล</dt>
            <dd className="select-all break-all font-semibold">{account.email}</dd>
            <dt>รหัสผ่าน</dt>
            <dd className="select-all font-semibold">{account.password}</dd>
          </dl>
          <button
            type="button"
            onClick={(e) => fill(e, account)}
            className={buttonClass("secondary", "h-10 min-h-0 px-4 text-[13px] font-semibold")}
          >
            ใช้บัญชี{account.label}
          </button>
        </div>
      ))}
    </div>
  );
}

export function LoginForm({ action, demoAccounts }: { action: FormAction; demoAccounts?: DemoAccount[] }) {
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
      {demoAccounts?.length ? <DemoAccounts accounts={demoAccounts} /> : null}
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
