import { Bell, LoaderCircle, LogOut } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { LogoutForm } from "@/components/auth/logout-button";
import { ActiveChats } from "@/components/owner/active-chats";
import { Deals } from "@/components/owner/deals";
import { Escalations } from "@/components/owner/escalations";
import { OwnerBottomNav, OwnerSidebar } from "@/components/owner/owner-nav";
import { OpenOrdersNote } from "@/components/owner/open-orders-note";
import { OwnerLive } from "@/components/owner/owner-live";
import { ProfitChart } from "@/components/owner/profit-chart";
import { StatTiles } from "@/components/owner/stat-tiles";
import { buttonClass } from "@/components/ui/button";
import { requireOwner } from "@/lib/auth/dal";
import { storefront } from "@/lib/config/storefront";
import { readOwnerData } from "@/lib/owner/dashboard";
import { confirmOrder, markOrderPaid } from "./actions";
import { ownerInitials, summarize, thaiDate } from "@/lib/owner/summary";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: `หน้าเถ้าแก่ — ${storefront.storeName}` };

export default function OwnerPage() {
  return (
    // อ่าน session (cookies) ได้เฉพาะหลัง Suspense — Cache Components
    <Suspense fallback={<OwnerLoading />}>
      <OwnerDashboard />
    </Suspense>
  );
}

function OwnerLoading() {
  return (
    <div role="status" className="flex h-dvh flex-col items-center justify-center gap-3 text-sm text-muted">
      <LoaderCircle aria-hidden="true" size={28} className="text-accent motion-safe:animate-spin" />
      กำลังโหลดภาพรวม…
    </div>
  );
}

/** หน้าเถ้าแก่ (Owner-Desktop / Owner-Mobile) — responsive หน้าเดียว breakpoint 768px */
async function OwnerDashboard() {
  const owner = await requireOwner();
  const now = new Date();
  // อ่านด้วยสิทธิ์ของ owner (RLS) ไม่ใช้ service role — ถ้า role ผิด ตัวเลขหลังบ้านจะไม่ออกเลย
  const { deals, escalations, openCount, incompleteDeals, activeChats, openOrders } = await readOwnerData(
    await createSupabaseServerClient(),
    now,
  );
  const totals = summarize(deals);
  const date = thaiDate(now);
  const bell = openCount > 0 ? `การแจ้งเตือน ${openCount} เรื่อง` : "ไม่มีการแจ้งเตือน";

  return (
    <div className="relative min-h-dvh p-0 md:p-6">
      {/* วงสีจางๆ ด้านบน ให้การ์ดกระจกใส (glass-clear) มีอะไรให้มองทะลุ */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[420px]"
        style={{
          background:
            "radial-gradient(circle 150px at 25% 14%, rgba(186,160,250,0.47) 0, rgba(186,160,250,0) 100%), radial-gradient(circle 140px at 44% 19%, rgba(146,192,255,0.45) 0, rgba(146,192,255,0) 100%), radial-gradient(circle 130px at 62% 11%, rgba(255,186,218,0.45) 0, rgba(255,186,218,0) 100%), radial-gradient(circle 140px at 86% 16%, rgba(255,196,160,0.42) 0, rgba(255,196,160,0) 100%)",
        }}
      />
      <div className="relative mx-auto flex max-w-[1392px] gap-6">
        <OwnerSidebar openCount={openCount} />

        <main className="flex min-w-0 flex-1 flex-col gap-[22px] px-4 pt-[18px] pb-[120px] md:px-0 md:py-1.5">
          <header className="flex items-center gap-2.5 md:flex-wrap md:justify-between md:gap-4">
            <div className="flex min-w-0 flex-1 flex-col md:flex-none">
              <span className="text-[13px] text-muted md:hidden">
                สวัสดี {owner.displayName} · {date}
              </span>
              <h1 className="text-2xl leading-[1.35] font-semibold md:text-[28px]">ภาพรวมวันนี้</h1>
              <span className="hidden text-sm text-muted md:inline">
                {storefront.storeName} · {date}
              </span>
              <OwnerLive />
              {incompleteDeals > 0 && (
                <p role="alert" className="text-xs text-warn-ink">
                  มี {incompleteDeals} ออเดอร์ที่ข้อมูลกำไรไม่ครบ ยังไม่ถูกนับในยอด
                </p>
              )}
            </div>
            <div className="flex items-center gap-2.5 md:gap-3">
              <Link
                href="#escalations"
                aria-label={bell}
                className="relative flex size-11 items-center justify-center rounded-[14px] border border-white/95 bg-white/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent md:size-[46px]"
              >
                <Bell aria-hidden="true" size={19} />
                {openCount > 0 && (
                  <span
                    aria-hidden="true"
                    className="absolute top-[9px] right-2.5 size-[9px] rounded-full border-2 border-white bg-warn"
                  />
                )}
              </Link>
              <span className="flex items-center gap-2.5">
                <span
                  aria-hidden="true"
                  className="flex size-11 items-center justify-center rounded-full bg-accent-tint text-sm font-semibold text-accent-ink"
                >
                  {ownerInitials(owner.displayName)}
                </span>
                <span className="hidden flex-col md:flex">
                  <span className="text-[15px] font-semibold">{owner.displayName}</span>
                  <span className="text-xs text-muted">เจ้าของร้าน</span>
                </span>
              </span>
            </div>
          </header>

          {/* มือถือเรียง: สรุป → รอตัดสิน → กราฟ → ดีล · คอม: เรื่องรอตัดสินอยู่คอลัมน์ขวา */}
          <div className="grid gap-[22px] md:grid-cols-[minmax(0,1fr)_300px] md:items-start">
            <div className="flex flex-col gap-3 md:col-start-1">
              <StatTiles totals={totals} />
              {/* ลูกค้าปิดดีลแล้วแต่ยังไม่จ่าย ยังไม่นับในตัวเลขด้านบน */}
              <OpenOrdersNote openOrders={openOrders} />
            </div>
            <div className="flex flex-col gap-[22px] md:col-start-2 md:row-span-3 md:row-start-1">
              <Escalations escalations={escalations} openCount={openCount} ownerName={storefront.ownerName} />
              <ActiveChats chats={activeChats} />
            </div>
            <div className="md:col-start-1">
              <ProfitChart deals={deals} />
            </div>
            <div className="md:col-start-1">
              <Deals deals={deals} markPaid={markOrderPaid} confirm={confirmOrder} />
            </div>
          </div>
          {/* มือถือไม่มีแถบซ้าย — ปุ่มออกจากระบบอยู่ท้ายหน้า (ไม่มีในไฟล์ดีไซน์) */}
          <LogoutForm className="md:hidden">
            <button type="submit" className={buttonClass("secondary", "h-11 w-full text-sm font-medium")}>
              <LogOut aria-hidden="true" size={17} />
              ออกจากระบบ
            </button>
          </LogoutForm>
        </main>
      </div>
      <OwnerBottomNav openCount={openCount} />
    </div>
  );
}
