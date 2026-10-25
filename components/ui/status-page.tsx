import type { ReactNode } from "react";
import { WelcomeBot, type BotPose } from "@/components/welcome/welcome-bot";

/** หน้าแจ้งสถานะเต็มจอ (ไม่พบหน้า / เกิดข้อผิดพลาด) — มาสคอตตัวเดียวกับคัตซีนต้อนรับ */
export function StatusPage({
  code,
  title,
  children,
  actions,
  pose = "chat",
}: {
  code?: string;
  title: string;
  children: ReactNode;
  actions: ReactNode;
  pose?: BotPose;
}) {
  return (
    <main className="flex min-h-dvh w-full flex-1 items-center justify-center px-4 py-10">
      <div className="glass flex w-full max-w-[440px] flex-col items-center gap-3 rounded-card px-5 py-8 text-center md:px-8">
        <WelcomeBot pose={pose} className="h-[120px] w-auto" />
        {code && <span className="text-[13px] font-semibold text-accent-ink">{code}</span>}
        <h1 className="text-xl font-semibold md:text-2xl">{title}</h1>
        <div className="text-sm leading-normal text-muted">{children}</div>
        <div className="mt-2 flex w-full flex-col gap-2.5 sm:flex-row sm:justify-center">{actions}</div>
      </div>
    </main>
  );
}
