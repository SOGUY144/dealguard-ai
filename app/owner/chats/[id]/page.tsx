import { LoaderCircle } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { OwnerChatFromServer } from "@/components/owner/owner-chat-from-server";
import { voiceInputAvailable } from "@/lib/ai/transcribe";
import { requireOwner } from "@/lib/auth/dal";
import { SupabaseChatStore } from "@/lib/chat-server/supabase-store";
import { storefront } from "@/lib/config/storefront";
import { readOwnerChat } from "@/lib/owner/chat";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: `แชตกับลูกค้า — ${storefront.storeName}` };

// อ่าน params + session ใน <Suspense> (Cache Components)
export default function OwnerChatPage({ params }: PageProps<"/owner/chats/[id]">) {
  return (
    <Suspense
      fallback={
        <div role="status" className="flex h-dvh flex-col items-center justify-center gap-3 text-sm text-muted">
          <LoaderCircle aria-hidden="true" size={28} className="text-accent motion-safe:animate-spin" />
          กำลังโหลดแชต…
        </div>
      }
    >
      <OwnerChat params={params} />
    </Suspense>
  );
}

async function OwnerChat({ params }: { params: PageProps<"/owner/chats/[id]">["params"] }) {
  const { id } = await params;
  await requireOwner();
  // อ่านด้วยสิทธิ์ของ owner (RLS) · สินค้าสำหรับอนุมัติราคา (มีต้นทุน) อ่านหลังยืนยันว่าเป็น owner แล้วเท่านั้น
  const [view, config] = await Promise.all([
    readOwnerChat(await createSupabaseServerClient(), id),
    new SupabaseChatStore(createSupabaseAdminClient()).loadConfig(),
  ]);
  if (!view) notFound();
  const approvalProducts = config.products.map(({ sku, name, listPrice, unitCost, floorPrice }) => ({
    sku,
    name,
    listPrice,
    unitCost,
    floorPrice,
  }));
  return (
    <OwnerChatFromServer
      initial={view}
      ownerName={storefront.ownerName}
      voiceInput={voiceInputAvailable()}
      approvalProducts={approvalProducts}
    />
  );
}
