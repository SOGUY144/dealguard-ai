import { LogOut } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { buttonClass } from "@/components/ui/button";
import { requireOwner } from "@/lib/auth/dal";
import { storefront } from "@/lib/config/storefront";
import { LogoutForm } from "@/components/auth/logout-button";

export const metadata: Metadata = { title: `หน้าเถ้าแก่ — ${storefront.storeName}` };

// ชั่วคราวจนถึงเฟส 7 (Owner-Desktop / Owner-Mobile) — ตอนนี้ใช้เช็กว่า role owner เข้าได้ buyer เข้าไม่ได้
export default function OwnerPage() {
  return (
    <Suspense>
      <OwnerHome />
    </Suspense>
  );
}

async function OwnerHome() {
  const owner = await requireOwner();
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[560px] flex-col justify-center gap-5 px-4 py-10">
      <div className="glass flex flex-col gap-4 rounded-card p-6 md:p-8">
        <span className="text-[13px] text-muted">{storefront.storeName} · หน้าเถ้าแก่</span>
        <h1 className="text-2xl font-semibold">สวัสดี {owner.displayName}</h1>
        <p className="text-[15px] leading-[1.6] text-muted">
          ภาพรวมดีล กำไรที่รักษาไว้ และเรื่องที่รอตัดสิน จะอยู่ที่หน้านี้ (กำลังทำในเฟส 7)
        </p>
        <div className="flex flex-wrap gap-2.5">
          <Link href="/" className={buttonClass("primary", "h-11")}>
            เปิดหน้าลูกค้า
          </Link>
          <LogoutForm>
            <button type="submit" className={buttonClass("secondary", "h-11")}>
              <LogOut aria-hidden="true" size={17} />
              ออกจากระบบ
            </button>
          </LogoutForm>
        </div>
      </div>
    </main>
  );
}
