import { Suspense } from "react";
import { ChatHeads } from "@/components/owner/chat-heads";
import { OrderAlertsProvider } from "@/components/owner/order-alerts";
import { confirmOrder, pendingOrderAlerts } from "./actions";
import { chatHeadSources } from "./chat-heads-actions";

/**
 * ทุกหน้าเถ้าแก่ (รวมหน้าแชต): ลูกค้าปิดดีลแล้วเด้งแจ้งเตือน + badge ออเดอร์รอยืนยันในเมนู
 * + หัวแชตลอยแบบ Messenger เมื่อลูกค้าทักมา — เช็กสิทธิ์ใน server action
 */
export default function OwnerLayout({ children }: LayoutProps<"/owner">) {
  return (
    <OrderAlertsProvider load={pendingOrderAlerts} confirm={confirmOrder}>
      {children}
      {/* อ่าน URL (usePathname) — ต้องอยู่ใน Suspense ไม่งั้น prerender หน้าแชตไม่ผ่าน (Cache Components) */}
      <Suspense fallback={null}>
        <ChatHeads load={chatHeadSources} />
      </Suspense>
    </OrderAlertsProvider>
  );
}
