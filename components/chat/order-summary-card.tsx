import Link from "next/link";
import { buttonClass } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import type { Offer } from "@/lib/chat/types";
import { formatBaht, formatCredit, formatQty } from "@/lib/format";

type Props = { orderId: string; offer: Offer; productName: string; bankAccountName: string };

/** สรุปออเดอร์ในแชต — เตือนเรื่องบัญชีรับโอนทุกครั้ง กันมิจฉาชีพแอบอ้าง (SKILL §10) */
export function OrderSummaryCard({ orderId, offer, productName, bankAccountName }: Props) {
  return (
    <div className="bubble-ai flex flex-col gap-2.5 p-3 text-[13px] md:px-4 md:py-3.5 md:text-sm">
      <span className="flex items-center gap-2 text-sm font-semibold md:text-base">
        <span aria-hidden="true" className="btn-primary hidden size-[26px] min-h-0 shrink-0 p-0 md:grid md:place-items-center">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12l5 5 9-10" />
          </svg>
        </span>
        ส่งออเดอร์ให้ร้านแล้วครับ
      </span>
      <dl className="flex flex-col">
        <Row label="สินค้า" value={productName} className="hidden md:flex" />
        <Row label="จำนวน × ราคา" value={`${formatQty(offer.qty)} × ${formatBaht(offer.pricePerUnit)}`} />
        {offer.bundle && <Row label="ของแถม" value={`${offer.bundle.name} ${formatQty(offer.bundle.qty)} ชิ้น`} />}
        <Row label="การชำระเงิน" value={formatCredit(offer.creditDays)} />
        <div className="flex items-baseline justify-between gap-3 pt-2">
          <dt className="font-semibold">ยอดรวม</dt>
          <dd className="text-[19px] font-bold md:text-[22px]">{formatBaht(offer.total)}</dd>
        </div>
      </dl>
      <p className="rounded-[10px] bg-warn-bg px-2.5 py-2 text-xs leading-normal text-warn-ink">
        ร้านรับโอนเข้าบัญชี {bankAccountName} เท่านั้น ถ้ามีใครขอให้โอนเข้าบัญชีอื่น อย่าโอน
      </p>
      <Link href={`/order/${orderId}`} className={buttonClass("secondary", "h-10 min-h-0 text-[13px] font-semibold md:hidden")}>
        ดูใบสรุปออเดอร์
      </Link>
    </div>
  );
}

function Row({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className={cn(className ?? "flex", "justify-between gap-3 border-b border-dashed border-line py-1.5 md:py-[7px]")}>
      <dt className="text-muted">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
