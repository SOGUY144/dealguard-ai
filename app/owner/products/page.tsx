import { LoaderCircle, LogOut } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { LogoutForm } from "@/components/auth/logout-button";
import { OwnerBottomNav, OwnerSidebar } from "@/components/owner/owner-nav";
import { ProductSettings } from "@/components/owner/product-settings";
import { buttonClass } from "@/components/ui/button";
import { requireOwner } from "@/lib/auth/dal";
import { storefront } from "@/lib/config/storefront";
import { countOpenEscalations } from "@/lib/owner/dashboard";
import { readProductSettings } from "@/lib/owner/products";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { saveSettings } from "./actions";

export const metadata: Metadata = { title: `สินค้าและราคา — ${storefront.storeName}` };

export default function OwnerProductsPage() {
  return (
    // อ่าน session (cookies) ได้เฉพาะหลัง Suspense — Cache Components
    <Suspense
      fallback={
        <div role="status" className="flex h-dvh flex-col items-center justify-center gap-3 text-sm text-muted">
          <LoaderCircle aria-hidden="true" size={28} className="text-accent motion-safe:animate-spin" />
          กำลังโหลดสินค้า…
        </div>
      }
    >
      <OwnerProducts />
    </Suspense>
  );
}

/** ตั้งค่าสินค้าและราคา (Owner-Settings) — responsive หน้าเดียว breakpoint 768px */
async function OwnerProducts() {
  await requireOwner();
  // อ่านด้วยสิทธิ์ของ owner (RLS) — ต้นทุน/ราคาพื้นออกเฉพาะเถ้าแก่
  const db = await createSupabaseServerClient();
  const [page, openCount] = await Promise.all([readProductSettings(db), countOpenEscalations(db)]);

  return (
    <div className="relative min-h-dvh p-0 md:p-6">
      <div className="relative mx-auto flex max-w-[1392px] gap-6">
        <OwnerSidebar openCount={openCount} current="products" />
        <main className="flex min-w-0 flex-1 flex-col gap-[22px] px-4 pt-[18px] pb-[120px] md:px-0 md:py-1.5">
          <ProductSettings page={page} save={saveSettings} />
          <LogoutForm className="md:hidden">
            <button type="submit" className={buttonClass("secondary", "h-11 w-full text-sm font-medium")}>
              <LogOut aria-hidden="true" size={17} />
              ออกจากระบบ
            </button>
          </LogoutForm>
        </main>
      </div>
      <OwnerBottomNav openCount={openCount} current="products" />
    </div>
  );
}
