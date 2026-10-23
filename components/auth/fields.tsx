"use client";

import type { InputHTMLAttributes, ReactNode } from "react";
import { useId } from "react";
import { useFormStatus } from "react-dom";
import { buttonClass } from "@/components/ui/button";
import { cn } from "@/lib/cn";

type FieldProps = InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string; hint?: string };

/** ช่องกรอกที่มี label มองเห็นได้ และ error อยู่ใต้ช่องที่ผิด (ผูกด้วย aria-describedby) */
export function TextField({ label, error, hint, className, ...input }: FieldProps) {
  const id = useId();
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(
          "h-12 rounded-input border bg-white px-4 text-[15px] outline-none transition-colors",
          "focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent-border",
          error ? "border-warn" : "border-line",
        )}
        {...input}
      />
      {error ? (
        <p id={`${id}-error`} className="text-[13px] text-warn-ink">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-[13px] text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function SubmitButton({ children, pendingText }: { children: ReactNode; pendingText: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} aria-disabled={pending} className={buttonClass("primary", "h-12 w-full text-base")}>
      {pending ? pendingText : children}
    </button>
  );
}

/** error รวม (role=alert) หรือข้อความแจ้งผล (role=status) ของทั้งฟอร์ม */
export function FormMessage({ error, notice }: { error?: string; notice?: string }) {
  if (error) {
    return (
      <p role="alert" className="rounded-[14px] bg-warn-bg px-3.5 py-2.5 text-sm text-warn-ink">
        {error}
      </p>
    );
  }
  if (notice) {
    return (
      <p role="status" className="rounded-[14px] bg-ok-bg px-3.5 py-2.5 text-sm text-ok-ink">
        {notice}
      </p>
    );
  }
  return null;
}
