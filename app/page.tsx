import { Suspense } from "react";
import { ChatScreenFromUrl } from "@/components/chat/chat-screen-from-url";
import { requireUser } from "@/lib/auth/dal";
import { publicProducts, storefront } from "@/lib/config/storefront";

export default function Home() {
  return (
    // อ่าน session (cookies) ได้เฉพาะหลัง Suspense — Cache Components
    <Suspense>
      <BuyerChat />
    </Suspense>
  );
}

async function BuyerChat() {
  const user = await requireUser("/");
  return (
    <ChatScreenFromUrl
      storefront={storefront}
      products={publicProducts}
      buyerName={user.displayName}
      canLogout
    />
  );
}
