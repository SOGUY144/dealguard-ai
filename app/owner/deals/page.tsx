import type { Metadata } from "next";
import { Suspense } from "react";
import { DealHistory } from "@/components/owner/deal-history";
import { OwnerLive } from "@/components/owner/owner-live";
import { OwnerLoading, OwnerShell } from "@/components/owner/owner-shell";
import { requireOwner } from "@/lib/auth/dal";
import { storefront } from "@/lib/config/storefront";
import { countOpenEscalations, readDeals } from "@/lib/owner/dashboard";
import { dealRangeStart, parseDealRange } from "@/lib/owner/summary";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { markOrderPaid } from "../actions";

export const metadata: Metadata = { title: `ดีลทั้งหมด — ${storefront.storeName}` };

// อ่าน searchParams + session ใน <Suspense> (Cache Components)
export default function OwnerDealsPage({ searchParams }: PageProps<"/owner/deals">) {
  return (
    <Suspense fallback={<OwnerLoading label="กำลังโหลดดีล…" />}>
      <OwnerDeals searchParams={searchParams} />
    </Suspense>
  );
}

async function OwnerDeals({ searchParams }: { searchParams: PageProps<"/owner/deals">["searchParams"] }) {
  const range = parseDealRange((await searchParams).range);
  await requireOwner();
  // อ่านด้วยสิทธิ์ของ owner (RLS) — margin ออกเฉพาะเถ้าแก่
  const db = await createSupabaseServerClient();
  const since = dealRangeStart(range, new Date());
  const [{ deals }, openCount] = await Promise.all([readDeals(db, since?.toISOString() ?? null), countOpenEscalations(db)]);
  return (
    <OwnerShell current="deals" openCount={openCount}>
      <OwnerLive />
      <DealHistory deals={deals} range={range} markPaid={markOrderPaid} />
    </OwnerShell>
  );
}
