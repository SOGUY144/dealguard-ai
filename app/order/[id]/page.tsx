import { notFound } from "next/navigation";
import { Suspense } from "react";
import { OrderReceipt } from "@/components/order/order-receipt";
import { getMockOrder, MOCK_ORDER_IDS } from "@/lib/chat/mock-orders";
import { storefront } from "@/lib/config/storefront";

// Cache Components ต้องการ param อย่างน้อย 1 ตัว — เฟส 2 มีแค่ออเดอร์เดโม เฟส 5 จะอ่านจากฐานข้อมูล
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
  const order = getMockOrder(id);
  if (!order) notFound();
  return <OrderReceipt order={order} storefront={storefront} />;
}
