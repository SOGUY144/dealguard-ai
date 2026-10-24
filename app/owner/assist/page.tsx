import type { Metadata } from "next";
import { Suspense } from "react";
import { AssistPanel } from "@/components/owner/assist-panel";
import { OwnerLoading, OwnerShell } from "@/components/owner/owner-shell";
import { requireOwner } from "@/lib/auth/dal";
import { storefront } from "@/lib/config/storefront";
import { countOpenEscalations } from "@/lib/owner/dashboard";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: `ผู้ช่วยตอบ LINE — ${storefront.storeName}` };

// โหมดผู้ช่วยเถ้าแก่: ลูกค้าคุยใน LINE ส่วนตัว → เถ้าแก่วางข้อความ ได้ข้อเสนอ + ข้อความพร้อมคัดลอก
export default function OwnerAssistPage() {
  return (
    <Suspense fallback={<OwnerLoading label="กำลังโหลด…" />}>
      <OwnerAssist />
    </Suspense>
  );
}

async function OwnerAssist() {
  await requireOwner();
  const openCount = await countOpenEscalations(await createSupabaseServerClient());
  return (
    <OwnerShell current="assist" openCount={openCount}>
      <AssistPanel />
    </OwnerShell>
  );
}
