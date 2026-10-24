"use client";

// ชิ้นส่วนฟอร์มของหน้าสินค้าเถ้าแก่ (Owner-Settings) — ช่องกรอก, สวิตช์, เส้นคั่น, หน้าต่างลอย
import { X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { IconButton } from "@/components/ui/button";
import { cn } from "@/lib/cn";

export function Hidden() {
  return <span className="font-normal text-muted">(ลูกค้าไม่เห็น)</span>;
}

export function Divider() {
  return <div aria-hidden="true" className="h-px bg-line/90" />;
}

export function Switch({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn("relative inline-block h-[26px] w-11 flex-none rounded-full transition-colors", on ? "bg-accent" : "bg-line")}
    >
      <span
        className={cn(
          "absolute top-[3px] size-5 rounded-full bg-white shadow-[0_2px_4px_rgba(0,0,0,0.15)] transition-[left] motion-reduce:transition-none",
          on ? "left-[21px]" : "left-[3px]",
        )}
      />
    </span>
  );
}

type FieldProps = {
  label: ReactNode;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  prefix?: string;
  suffix?: string;
  hint?: string;
  emphasis?: boolean;
  /** text = ชื่อ/รหัส · number = ตัวเลข (ค่าเริ่มต้น) */
  type?: "text" | "number";
  autoFocus?: boolean;
  maxLength?: number;
};

export function Field({ label, value, onChange, error, prefix, suffix, hint, emphasis, type = "number", autoFocus, maxLength }: FieldProps) {
  const id = useId();
  const describedBy = [error && `${id}-error`, hint && `${id}-hint`].filter(Boolean).join(" ") || undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="flex items-center gap-1.5 text-[13px] font-medium">
        {label}
      </label>
      <div
        className={cn(
          "flex h-12 items-center gap-1.5 rounded-[14px] px-3.5 focus-within:outline-2 focus-within:outline-offset-1 focus-within:outline-accent",
          error
            ? "border-[1.5px] border-warn bg-warn-bg"
            : emphasis
              ? "border-[1.5px] border-[#B9A5F0] bg-accent-tint/85"
              : "border border-line bg-white/85",
        )}
      >
        {prefix && <span className={emphasis ? "text-accent-ink" : "text-muted"}>{prefix}</span>}
        <input
          id={id}
          type={type}
          inputMode={type === "number" ? "decimal" : undefined}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          autoFocus={autoFocus}
          maxLength={maxLength}
          className={cn(
            "h-11 min-w-0 flex-auto bg-transparent text-base outline-none",
            emphasis ? "font-semibold text-accent-strong" : "font-medium",
          )}
        />
        {suffix && <span className="whitespace-nowrap text-muted">{suffix}</span>}
      </div>
      {error && (
        <span id={`${id}-error`} className="text-xs text-warn-ink">
          {error}
        </span>
      )}
      {hint && (
        <span id={`${id}-hint`} className="text-xs text-muted">
          {hint}
        </span>
      )}
    </div>
  );
}

/** สถานะบันทึกใต้ปุ่ม — status = สำเร็จ, alert = ผิด */
export type Status = { kind: "idle" } | { kind: "saving" } | { kind: "saved"; message: string } | { kind: "error"; message: string };

export function StatusLine({ status, className }: { status: Status; className?: string }) {
  return (
    <div aria-live="polite" className={cn("text-sm empty:hidden", className)}>
      {status.kind === "saving" && <span className="text-muted">กำลังบันทึก…</span>}
      {status.kind === "saved" && (
        <span role="status" className="text-ok-ink">
          {status.message}
        </span>
      )}
      {status.kind === "error" && (
        <span role="alert" className="text-warn-ink">
          {status.message}
        </span>
      )}
    </div>
  );
}

/** หน้าต่างลอย (เพิ่มสินค้า / นำเข้า / ยืนยันลบ) — Esc หรือกดพื้นหลังเพื่อปิด, โฟกัสกลับที่ปุ่มเดิม */
export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    if (!panel.current?.contains(document.activeElement)) panel.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      opener?.focus?.();
    };
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-[rgba(43,45,62,0.28)] p-0 md:items-center md:p-6">
      <button type="button" aria-label="ปิด" tabIndex={-1} onClick={onClose} className="absolute inset-0 cursor-default" />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn(
          "glass relative flex max-h-[92dvh] w-full flex-col gap-4 overflow-y-auto rounded-t-[26px] bg-white/90 p-5 outline-none md:rounded-[26px] md:p-6",
          wide ? "md:max-w-[760px]" : "md:max-w-[520px]",
        )}
      >
        <div className="flex items-center justify-between gap-3">
          <h2 id={titleId} className="text-lg font-semibold">
            {title}
          </h2>
          <IconButton label="ปิด" variant="ghost" onClick={onClose}>
            <X aria-hidden="true" size={18} />
          </IconButton>
        </div>
        {children}
      </div>
    </div>
  );
}
