import { LoaderCircle } from "lucide-react";
import { Suspense } from "react";
import { ChatScreenFromUrl } from "@/components/chat/chat-screen-from-url";
import { warmUpIntentLlm } from "@/lib/ai/openai";
import { requireUser } from "@/lib/auth/dal";
import { createChatDeps } from "@/lib/chat-server/deps";
import { loadChatPage } from "@/lib/chat-server/pipeline";
import { storefront } from "@/lib/config/storefront";

export default function Home() {
  return (
    // อ่าน session (cookies) ได้เฉพาะหลัง Suspense — Cache Components
    <Suspense fallback={<ChatLoading />}>
      <BuyerChat />
    </Suspense>
  );
}

/** ระหว่างรอ session + โหลดแชตจากฐานข้อมูล — ไม่ให้หน้าขาวเปล่า */
function ChatLoading() {
  return (
    <div role="status" className="flex h-dvh flex-col items-center justify-center gap-3 text-sm text-muted">
      <LoaderCircle aria-hidden="true" size={28} className="text-accent motion-safe:animate-spin" />
      กำลังโหลดแชต…
    </div>
  );
}

async function BuyerChat() {
  const user = await requireUser("/");
  // โหลดแชตเดิมที่ server เลย — หน้าแรกที่ส่งมาตรงกับใน browser (ไม่กระพริบ/ไม่ hydration mismatch)
  const { view: initialView, products } = await loadChatPage(createChatDeps(), {
    id: user.id,
    displayName: user.displayName,
  });
  // ปลุก GPT ไว้ก่อนลูกค้าพิมพ์ (request แรกหลังว่างนานช้า 7–13 วินาที)
  warmUpIntentLlm();
  return (
    <ChatScreenFromUrl
      storefront={storefront}
      products={products}
      buyerName={user.displayName}
      canLogout
      live={{ initialView }}
    />
  );
}
