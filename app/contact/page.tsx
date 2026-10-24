import type { Metadata } from "next";
import { ContactContent } from "@/components/store/contact-content";
import { InfoPage } from "@/components/store/info-page";
import { storefront } from "@/lib/config/storefront";

export const metadata: Metadata = { title: `ติดต่อร้าน — ${storefront.storeName}` };

export default function ContactPage() {
  return (
    <InfoPage storefront={storefront} current="contact" title="ติดต่อร้าน">
      <ContactContent storefront={storefront} />
    </InfoPage>
  );
}
