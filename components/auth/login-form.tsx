"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useActionState, type MouseEvent } from "react";
import { buttonClass } from "@/components/ui/button";
import type { FormAction } from "@/lib/auth/form-state";
import { FormMessage, SubmitButton, TextField } from "./fields";
import { WelcomeHandoff } from "./welcome-handoff";

type DemoAccount = { email: string; password: string };

/** บัญชีลูกค้าทดลองให้กรรมการ — กดแล้วกรอกให้ ไม่ต้องพิมพ์เอง */
function DemoAccountBox({ email, password }: DemoAccount) {
  const fill = (e: MouseEvent<HTMLButtonElement>) => {
    const fields = e.currentTarget.form?.elements;
    for (const [name, value] of [["email", email], ["password", password]] as const) {
      const input = fields?.namedItem(name) as HTMLInputElement | null;
      if (input) input.value = value;
    }
  };
  return (
    <div role="note" className="flex flex-col gap-2 rounded-2xl bg-accent-tint p-4 text-sm text-accent-ink">
      <p className="font-semibold">บัญชีลูกค้าทดลองสำหรับกรรมการ</p>
      <p>มีแชตต่อราคากับ AI ไว้ให้ดูแล้ว เข้าไปคุยต่อได้เลย</p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
        <dt>อีเมล</dt>
        <dd className="select-all break-all font-semibold">{email}</dd>
        <dt>รหัสผ่าน</dt>
        <dd className="select-all font-semibold">{password}</dd>
      </dl>
      <button type="button" onClick={fill} className={buttonClass("secondary", "h-10 min-h-0 px-4 text-[13px] font-semibold")}>
        ใช้บัญชีทดลอง
      </button>
    </div>
  );
}

export function LoginForm({ action, demoAccount }: { action: FormAction; demoAccount?: DemoAccount }) {
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
      {demoAccount && <DemoAccountBox {...demoAccount} />}
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
