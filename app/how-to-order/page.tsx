import type { Metadata } from "next";
import { HowToOrderContent } from "@/components/store/how-to-order-content";
import { InfoPage } from "@/components/store/info-page";
import { storefront } from "@/lib/config/storefront";

export const metadata: Metadata = { title: `วิธีสั่งซื้อ — ${storefront.storeName}` };

export default function HowToOrderPage() {
  return (
    <InfoPage storefront={storefront} current="how" title="วิธีสั่งซื้อ">
      <HowToOrderContent storefront={storefront} />
    </InfoPage>
  );
}
