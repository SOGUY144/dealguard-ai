import {
  Clock,
  LayoutGrid,
  List,
  LogOut,
  MessageSquareText,
  ReceiptText,
  Tag,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { LogoutForm } from "@/components/auth/logout-button";
import { buttonClass } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { PendingOrdersBadge } from "./order-alerts";

export type OwnerPage =
  "overview" | "orders" | "deals" | "escalations" | "products" | "assist";
type Props = { openCount: number; current?: OwnerPage };

type Item = {
  label: string;
  short: string;
  href?: string;
  icon: ReactNode;
  current?: boolean;
  badge?: number;
  /** badge ออเดอร์รอยืนยัน — มาจากตัวแจ้งเตือน (อัปเดตสด ไม่ต้องโหลดหน้า) */
  pendingOrders?: boolean;
  /** ไม่อยู่ในเมนูล่างของมือถือ (มีได้ 5 ช่อง) */
  desktopOnly?: boolean;
};

function items(openCount: number, current: OwnerPage): Item[] {
  return [
    {
      label: "ภาพรวม",
      short: "ภาพรวม",
      href: "/owner",
      icon: <LayoutGrid size={18} />,
      current: current === "overview",
    },
    // ลูกค้าปิดดีลแล้ว → ยืนยันออเดอร์ / รับเงิน โดยไม่ต้องเข้าแชต
    {
      label: "ออเดอร์และชำระเงิน",
      short: "ออเดอร์",
      href: "/owner/orders",
      icon: <ReceiptText size={18} />,
      pendingOrders: true,
      current: current === "orders",
    },
    // มือถือ: ดีลทั้งหมดเข้าจาก "ดูทั้งหมด" ในหน้าภาพรวม
    {
      label: "ดีลทั้งหมด",
      short: "ดีล",
      href: "/owner/deals",
      icon: <List size={18} />,
      current: current === "deals",
      desktopOnly: true,
    },
    {
      label: "รอตัดสิน",
      short: "รอตัดสิน",
      href: "/owner/escalations",
      icon: <Clock size={18} />,
      badge: openCount,
      current: current === "escalations",
    },
    {
      label: "สินค้าและราคา",
      short: "สินค้า",
      href: "/owner/products",
      icon: <Tag size={18} />,
      current: current === "products",
    },
    // ลูกค้าคุยใน LINE ส่วนตัว (บอทเข้าไม่ได้) → วางข้อความ ได้ข้อเสนอ + ข้อความพร้อมคัดลอก
    {
      label: "ผู้ช่วยตอบ LINE",
      short: "ช่วยตอบ",
      href: "/owner/assist",
      icon: <MessageSquareText size={18} />,
      current: current === "assist",
    },
  ];
}

function Badge({ count, className }: { count: number; className?: string }) {
  if (count <= 0) return null;
  return (
    <span
      className={cn(
        "flex h-6 min-w-6 items-center justify-center rounded-full bg-warn px-[7px] text-xs font-semibold text-white",
        className,
      )}
    >
      <span className="sr-only"> มี </span>
      {count}
      <span className="sr-only"> เรื่อง</span>
    </span>
  );
}

/** คอม: แถบเมนูซ้าย (Owner-Desktop) — ไม่มีโลโก้ มีแค่คำว่า DealGuard */
export function OwnerSidebar({ openCount, current = "overview" }: Props) {
  return (
    <aside
      aria-label="เมนูเถ้าแก่"
      className="glass hidden w-[240px] shrink-0 flex-col gap-7 self-stretch rounded-[28px] px-4 py-6 md:flex"
    >
      <span className="px-2 text-[22px] font-bold">DealGuard</span>
      <nav className="flex flex-col gap-1">
        {items(openCount, current).map((item) => {
          const content = (
            <>
              <span
                aria-hidden="true"
                className={item.current ? "text-accent-ink" : "text-muted"}
              >
                {item.icon}
              </span>
              <span className="flex-1">{item.label}</span>
              {item.badge !== undefined && <Badge count={item.badge} />}
              {item.pendingOrders && <PendingOrdersBadge variant="sidebar" />}
            </>
          );
          const base =
            "flex h-[46px] items-center gap-3 rounded-[14px] px-3.5 text-sm";
          if (!item.href) {
            return (
              <span
                key={item.label}
                aria-disabled="true"
                className={cn(base, "font-medium text-muted")}
              >
                {content}
              </span>
            );
          }
          return (
            <Link
              key={item.label}
              href={item.href}
              aria-current={item.current ? "page" : undefined}
              className={cn(
                base,
                item.current
                  ? "bg-accent-tint font-semibold text-accent-ink"
                  : "font-medium text-ink hover:bg-white/60",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
              )}
            >
              {content}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto flex flex-col gap-2.5 rounded-[20px] bg-[rgba(239,233,253,0.7)] p-4">
        <span className="text-sm font-semibold">หน้าแชตของร้าน</span>
        <span className="text-[13px] leading-[1.5] text-muted">
          ลองดูว่าลูกค้าเห็นอะไรตอนต่อราคา
        </span>
        <Link
          href="/"
          className={buttonClass("primary", "h-10 min-h-0 text-[13px]")}
        >
          เปิดหน้าลูกค้า
        </Link>
      </div>
      <LogoutForm>
        <button
          type="submit"
          className={buttonClass(
            "ghost",
            "h-11 w-full justify-start px-3.5 text-sm",
          )}
        >
          <LogOut aria-hidden="true" size={17} />
          ออกจากระบบ
        </button>
      </LogoutForm>
    </aside>
  );
}

/** มือถือ: แถบเมนูล่างแบบแคปซูลลอย (Owner-Mobile) */
export function OwnerBottomNav({ openCount, current = "overview" }: Props) {
  return (
    <nav
      aria-label="เมนูเถ้าแก่"
      className="glass-pill fixed inset-x-3 bottom-3 z-20 grid grid-cols-5 p-1.5 pb-[max(6px,env(safe-area-inset-bottom))] md:hidden"
    >
      {items(openCount, current)
        .filter((item) => !item.desktopOnly)
        .map((item) => {
          const content = (
            <>
              <span aria-hidden="true" className="relative">
                {item.icon}
                {item.pendingOrders && <PendingOrdersBadge variant="bottom" />}
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="absolute -top-2 -right-3 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-warn px-1 text-[11px] font-semibold text-white">
                    {item.badge}
                  </span>
                )}
              </span>
              <span>
                {item.short}
                {item.badge ? (
                  <span className="sr-only"> {item.badge} เรื่อง</span>
                ) : null}
                {item.pendingOrders && <PendingOrdersBadge variant="sr" />}
              </span>
            </>
          );
          const base =
            "flex min-h-[52px] flex-col items-center justify-center gap-1 rounded-full text-xs";
          if (!item.href) {
            return (
              <span
                key={item.label}
                aria-disabled="true"
                className={cn(base, "text-muted")}
              >
                {content}
              </span>
            );
          }
          return (
            <Link
              key={item.label}
              href={item.href}
              aria-current={item.current ? "page" : undefined}
              className={cn(
                base,
                item.current
                  ? "bg-accent-tint font-semibold text-accent-ink"
                  : "text-ink",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
              )}
            >
              {content}
            </Link>
          );
        })}
    </nav>
  );
}
