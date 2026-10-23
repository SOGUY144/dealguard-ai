import type { ButtonHTMLAttributes, ReactNode, Ref } from "react";
import { cn } from "@/lib/cn";

// กระจกทั้งหมดมาจาก design/tokens.css (.btn-primary / .btn-secondary / .chip) — ห้ามกลับไปใช้ปุ่มม่วงทึบ
const VARIANTS = {
  primary: "btn-primary",
  secondary: "btn-secondary",
  chip: "chip text-left",
  /** ปุ่มขาวนูน เช่น "คุยกับคนจริง" บน header */
  white: "rounded-full bg-white font-medium shadow-[0_4px_14px_rgba(110,90,170,0.12)]",
  ghost: "rounded-full bg-transparent text-muted",
} as const;

export type ButtonVariant = keyof typeof VARIANTS;

export function buttonClass(variant: ButtonVariant = "secondary", className?: string): string {
  return cn(
    "inline-flex items-center justify-center gap-2 whitespace-nowrap transition-[transform,opacity] duration-150",
    "active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
    VARIANTS[variant],
    className,
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant };

export function Button({ variant, className, type = "button", ...props }: ButtonProps) {
  return <button type={type} className={buttonClass(variant, className)} {...props} />;
}

type IconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-label"> & {
  ref?: Ref<HTMLButtonElement>;
  /** ชื่อปุ่มสำหรับ screen reader — ปุ่มไอคอนต้องมีเสมอ */
  label: string;
  variant?: ButtonVariant | "soft";
  children: ReactNode;
};

/** ปุ่มวงกลม 44px สำหรับไอคอนอย่างเดียว */
export function IconButton({ label, variant = "white", className, type = "button", ...props }: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      className={cn(
        buttonClass(variant === "soft" ? "ghost" : variant),
        "size-11 shrink-0 rounded-full p-0",
        variant === "soft" && "bg-[#F7F4FD] text-ink",
        className,
      )}
      {...props}
    />
  );
}
