import { notFound } from "next/navigation";
import { Suspense } from "react";
import { OrderLive } from "@/components/order/order-live";
import { OrderReceipt } from "@/components/order/order-receipt";
import { requireUser } from "@/lib/auth/dal";
import { readOrder } from "@/lib/chat-server/orders";
import { getMockOrder, MOCK_ORDER_IDS } from "@/lib/chat/mock-orders";
import { storefront } from "@/lib/config/storefront";
import { paymentFor } from "@/lib/payment/order-payment";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Cache Components ต้องการ param อย่างน้อย 1 ตัว — ใช้ออเดอร์เดโม (demo-A/B/C ของ /?state=…) ส่วนออเดอร์จริงอ่านตอนมี request
export function generateStaticParams() {
  return MOCK_ORDER_IDS.map((id) => ({ id }));
}

// อ่าน params ใน <Suspense> เพื่อให้กดลิงก์จากแชตแล้วเปลี่ยนหน้าได้ทันที (partial prefetching)
export default function OrderPage({ params }: PageProps<"/order/[id]">) {
  return (
    <Suspense>
      <Order params={params} />
    </Suspense>
  );
}

async function Order({ params }: { params: PageProps<"/order/[id]">["params"] }) {
  const { id } = await params;
  await requireUser(`/order/${encodeURIComponent(id)}`);
  // ออเดอร์จริงอ่านด้วยสิทธิ์ของผู้ใช้ (RLS) — ลูกค้าเปิดออเดอร์ของคนอื่นได้ "ไม่พบ"
  const mock = getMockOrder(id);
  const order = mock ?? (await readOrder(await createSupabaseServerClient(), id));
  if (!order) notFound();
  return (
    <>
      {/* ร้านกด "ได้รับเงินแล้ว" → ใบสรุปเปลี่ยนเอง (ออเดอร์เดโมไม่มีในฐานข้อมูล ไม่ต้องฟัง) */}
      {!mock && <OrderLive orderId={order.id} />}
      <OrderReceipt order={order} storefront={storefront} payment={await paymentFor(order)} />
    </>
  );
}
