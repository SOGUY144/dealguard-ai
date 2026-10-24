import type { Metadata } from "next";
import { Suspense } from "react";
import { OwnerLoading, OwnerShell } from "@/components/owner/owner-shell";
import { ProductSettings } from "@/components/owner/product-settings";
import { requireOwner } from "@/lib/auth/dal";
import { storefront } from "@/lib/config/storefront";
import { countOpenEscalations } from "@/lib/owner/dashboard";
import { readProductSettings } from "@/lib/owner/products";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { addProduct, deleteCatalogItem, deleteImage, importCatalog, saveGiftItem, saveSettings, uploadImage } from "./actions";

export const metadata: Metadata = { title: `สินค้าและราคา — ${storefront.storeName}` };

export default function OwnerProductsPage() {
  return (
    // อ่าน session (cookies) ได้เฉพาะหลัง Suspense — Cache Components
    <Suspense fallback={<OwnerLoading label="กำลังโหลดสินค้า…" />}>
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
    <OwnerShell current="products" openCount={openCount}>
      <ProductSettings
        page={page}
        actions={{
          save: saveSettings,
          addProduct,
          saveGift: saveGiftItem,
          deleteItem: deleteCatalogItem,
          uploadImage,
          deleteImage,
          importCatalog,
        }}
      />
    </OwnerShell>
  );
}
