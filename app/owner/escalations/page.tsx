import type { Metadata } from "next";
import { Suspense } from "react";
import { EscalationHistory } from "@/components/owner/escalation-history";
import { OwnerLive } from "@/components/owner/owner-live";
import { OwnerLoading, OwnerShell } from "@/components/owner/owner-shell";
import { requireOwner } from "@/lib/auth/dal";
import { storefront } from "@/lib/config/storefront";
import { countOpenEscalations, readEscalationHistory } from "@/lib/owner/dashboard";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: `เรื่องที่ส่งให้เถ้าแก่ — ${storefront.storeName}` };

export default function OwnerEscalationsPage({ searchParams }: PageProps<"/owner/escalations">) {
  return (
    <Suspense fallback={<OwnerLoading label="กำลังโหลดเรื่องที่ส่งต่อ…" />}>
      <OwnerEscalations searchParams={searchParams} />
    </Suspense>
  );
}

async function OwnerEscalations({ searchParams }: { searchParams: PageProps<"/owner/escalations">["searchParams"] }) {
  const status = (await searchParams).status === "resolved" ? "resolved" : "open";
  await requireOwner();
  const db = await createSupabaseServerClient();
  const [entries, openCount] = await Promise.all([readEscalationHistory(db, status), countOpenEscalations(db)]);
  return (
    <OwnerShell current="escalations" openCount={openCount}>
      <OwnerLive />
      <EscalationHistory entries={entries} status={status} openCount={openCount} />
    </OwnerShell>
  );
}
