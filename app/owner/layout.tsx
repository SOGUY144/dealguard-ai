import { OrderAlertsProvider } from "@/components/owner/order-alerts";
import { confirmOrder, pendingOrderAlerts } from "./actions";

/** ทุกหน้าเถ้าแก่ (รวมหน้าแชต): ลูกค้าปิดดีลแล้วเด้งแจ้งเตือน + badge ออเดอร์รอยืนยันในเมนู — เช็กสิทธิ์ใน server action */
export default function OwnerLayout({ children }: LayoutProps<"/owner">) {
  return (
    <OrderAlertsProvider load={pendingOrderAlerts} confirm={confirmOrder}>
      {children}
    </OrderAlertsProvider>
  );
}
