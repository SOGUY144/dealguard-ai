import type { Metadata } from "next";
import { Suspense } from "react";
import { OrderBoard } from "@/components/owner/order-board";
import { OwnerLive } from "@/components/owner/owner-live";
import { OwnerLoading, OwnerShell } from "@/components/owner/owner-shell";
import { requireOwner } from "@/lib/auth/dal";
import { storefront } from "@/lib/config/storefront";
import { countOpenEscalations, readOrderBoard } from "@/lib/owner/dashboard";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { confirmOrder, markOrderPaid } from "../actions";

export const metadata: Metadata = { title: `ออเดอร์และชำระเงิน — ${storefront.storeName}` };

// อ่าน session ใน <Suspense> (Cache Components)
export default function OwnerOrdersPage() {
  return (
    <Suspense fallback={<OwnerLoading label="กำลังโหลดออเดอร์…" />}>
      <OwnerOrders />
    </Suspense>
  );
}

async function OwnerOrders() {
  await requireOwner();
  // อ่านด้วยสิทธิ์ของ owner (RLS)
  const db = await createSupabaseServerClient();
  const [board, openCount] = await Promise.all([readOrderBoard(db, new Date()), countOpenEscalations(db)]);
  return (
    <OwnerShell current="orders" openCount={openCount}>
      {/* ลูกค้าปิดดีลใหม่ / กดจากอีกแท็บ → การ์ดย้ายกลุ่มเอง */}
      <OwnerLive />
      <OrderBoard board={board} confirm={confirmOrder} markPaid={markOrderPaid} />
    </OwnerShell>
  );
}
