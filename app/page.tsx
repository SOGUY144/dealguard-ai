import { LoaderCircle } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { ChatScreenFromUrl } from "@/components/chat/chat-screen-from-url";
import { warmUpIntentLlm } from "@/lib/ai/openai";
import { voiceInputAvailable } from "@/lib/ai/transcribe";
import { requireUser } from "@/lib/auth/dal";
import { createChatDeps } from "@/lib/chat-server/deps";
import { loadChatPage, toPublicProducts } from "@/lib/chat-server/pipeline";
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
  // เถ้าแก่/กรรมการกด "เปิดหน้าลูกค้า" → ดูตัวอย่าง (ตัวตอบจำลอง) ไม่สร้างแชต/ออเดอร์จริง ยอดบนหน้าเถ้าแก่จึงไม่เพี้ยน
  if (user.role === "owner") return <OwnerPreview />;
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
      voiceInput={voiceInputAvailable()}
    />
  );
}

async function OwnerPreview() {
  const config = await createChatDeps().store.loadConfig();
  return (
    <>
      <p role="note" className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-accent-tint px-4 py-2 text-center text-[13px] text-accent-ink">
        หน้าตัวอย่างของลูกค้า — ข้อความไม่ถูกบันทึก และไม่นับเป็นยอดขาย
        <Link href="/owner" className="font-semibold underline underline-offset-2">
          กลับหน้าเถ้าแก่
        </Link>
      </p>
      <ChatScreenFromUrl storefront={storefront} products={toPublicProducts(config)} buyerName="ลูกค้าตัวอย่าง" canLogout />
    </>
  );
}

