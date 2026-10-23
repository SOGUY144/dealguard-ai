import type { ReactNode } from "react";

/** กรอบหน้าสมัคร/ล็อกอิน — ไม่มีในไฟล์ดีไซน์ ใช้ tokens และกระจกชุดเดียวกับหน้าแชต */
export function AuthShell({
  storeName,
  title,
  subtitle,
  children,
}: {
  storeName: string;
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[440px] flex-col justify-center gap-6 px-4 py-10">
      <div className="flex flex-col items-center gap-1 text-center">
        <span className="text-[13px] text-muted">{storeName}</span>
        <h1 className="text-2xl font-semibold md:text-[28px]">{title}</h1>
        {subtitle && <p className="text-sm leading-normal text-muted">{subtitle}</p>}
      </div>
      <div className="glass rounded-card p-5 md:p-7">{children}</div>
    </main>
  );
}
