// ติดต่อร้าน — ไม่มีในไฟล์ดีไซน์ ข้อมูลมาจาก lib/config/storefront.ts (ค่าเดโม ร้านจริงต้องเปลี่ยนเป็นของตัวเอง)
import { Landmark, MessageCircle, Shield, Store } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { TalkToOwnerButton } from "@/components/chat/talk-to-owner-button";
import { buttonClass } from "@/components/ui/button";
import type { Storefront } from "@/lib/chat/types";

function Row({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent-tint text-accent-ink">
        {icon}
      </span>
      <div className="flex min-w-0 flex-col">
        <dt className="text-[13px] text-muted">{label}</dt>
        <dd className="font-medium">{children}</dd>
      </div>
    </div>
  );
}

export function ContactContent({ storefront }: { storefront: Storefront }) {
  return (
    <>
      <dl className="glass flex flex-col gap-4 rounded-card p-5 md:p-7">
        <Row icon={<Store size={18} />} label="ร้าน">
          <span className="block">{storefront.storeName}</span>
          <span className="block text-sm font-normal text-muted">
            {storefront.tagline} · เจ้าของร้าน {storefront.ownerName}
          </span>
        </Row>
        <Row icon={<MessageCircle size={18} />} label="ช่องทางติดต่อ">
          {storefront.contactChannel}
        </Row>
        <Row icon={<Landmark size={18} />} label="บัญชีรับโอน">
          {storefront.bankAccountName}
        </Row>
      </dl>
      <div className="flex items-start gap-2.5 rounded-2xl bg-warn-bg px-4 py-3 text-sm text-warn-ink">
        <Shield aria-hidden="true" size={17} className="mt-0.5 shrink-0" />
        <span>ร้านรับโอนเข้าบัญชีนี้เท่านั้น ถ้ามีใครขอให้โอนเข้าบัญชีอื่น อย่าโอน</span>
      </div>
      <div className="flex flex-col gap-2">
        <TalkToOwnerButton ownerName={storefront.ownerName} />
        <Link href="/" className={buttonClass("primary", "h-[52px] text-base")}>
          แชตต่อราคากับผู้ช่วย AI
        </Link>
      </div>
    </>
  );
}
