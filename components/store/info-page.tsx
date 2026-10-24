import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { StoreHeader, type StorePage } from "@/components/chat/store-header";
import { buttonClass } from "@/components/ui/button";
import type { Storefront } from "@/lib/chat/types";

/** โครงหน้าข้อมูลร้าน (วิธีสั่งซื้อ / ติดต่อร้าน) — คอมใช้แถบร้านเดียวกับหน้าแชต · มือถือมีปุ่มกลับไปแชต */
export function InfoPage({
  storefront,
  current,
  title,
  children,
}: {
  storefront: Storefront;
  current: StorePage;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <StoreHeader storeName={storefront.storeName} tagline={storefront.tagline} current={current} />
      <header className="glass-pill mx-3 mt-3 flex items-center gap-2.5 py-2 pr-4 pl-2 md:hidden">
        <Link href="/" aria-label="กลับไปแชต" className={buttonClass("white", "size-11 p-0")}>
          <ArrowLeft aria-hidden="true" size={19} />
        </Link>
        <span className="text-base font-semibold">{storefront.storeName}</span>
      </header>
      <main className="mx-auto flex w-full max-w-[720px] flex-col gap-5 px-4 py-6 md:py-10">
        <h1 className="text-2xl font-semibold md:text-[28px]">{title}</h1>
        {children}
      </main>
    </div>
  );
}
