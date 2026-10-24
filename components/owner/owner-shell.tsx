import { LoaderCircle, LogOut } from "lucide-react";
import type { ReactNode } from "react";
import { LogoutForm } from "@/components/auth/logout-button";
import { buttonClass } from "@/components/ui/button";
import { OwnerBottomNav, OwnerSidebar } from "./owner-nav";

type Page = "deals" | "escalations" | "products";

/** โครงหน้าเถ้าแก่ (นอกจากภาพรวม): แถบซ้าย (คอม) / เมนูล่าง (มือถือ) + ปุ่มออกจากระบบท้ายหน้าบนมือถือ */
export function OwnerShell({ current, openCount, children }: { current: Page; openCount: number; children: ReactNode }) {
  return (
    <div className="relative min-h-dvh p-0 md:p-6">
      <div className="relative mx-auto flex max-w-[1392px] gap-6">
        <OwnerSidebar openCount={openCount} current={current} />
        <main className="flex min-w-0 flex-1 flex-col gap-[22px] px-4 pt-[18px] pb-[120px] md:px-0 md:py-1.5">
          {children}
          <LogoutForm className="md:hidden">
            <button type="submit" className={buttonClass("secondary", "h-11 w-full text-sm font-medium")}>
              <LogOut aria-hidden="true" size={17} />
              ออกจากระบบ
            </button>
          </LogoutForm>
        </main>
      </div>
      <OwnerBottomNav openCount={openCount} current={current} />
    </div>
  );
}

export function OwnerLoading({ label }: { label: string }) {
  return (
    <div role="status" className="flex h-dvh flex-col items-center justify-center gap-3 text-sm text-muted">
      <LoaderCircle aria-hidden="true" size={28} className="text-accent motion-safe:animate-spin" />
      {label}
    </div>
  );
}
