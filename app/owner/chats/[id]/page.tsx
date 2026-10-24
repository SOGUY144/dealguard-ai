import { LoaderCircle } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { OwnerChatFromServer } from "@/components/owner/owner-chat-from-server";
import { voiceInputAvailable } from "@/lib/ai/transcribe";
import { requireOwner } from "@/lib/auth/dal";
import { storefront } from "@/lib/config/storefront";
import { readOwnerChat } from "@/lib/owner/chat";
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
  // อ่านด้วยสิทธิ์ของ owner (RLS)
  const view = await readOwnerChat(await createSupabaseServerClient(), id);
  if (!view) notFound();
  return <OwnerChatFromServer initial={view} ownerName={storefront.ownerName} voiceInput={voiceInputAvailable()} />;
}
