import { ArrowLeft, Check, Shield } from "lucide-react";
import Link from "next/link";
import { buttonClass } from "@/components/ui/button";
import type { OrderView } from "@/lib/chat/mock-orders";
import type { Storefront } from "@/lib/chat/types";
import { formatBaht, formatClock, formatCredit, formatQty } from "@/lib/format";

type Props = { order: OrderView; storefront: Storefront };

/** ใบสรุปออเดอร์เต็มจอ (Mobile-Order) — บนคอมจัดกลางกว้างไม่เกิน 480px */
export function OrderReceipt({ order, storefront }: Props) {
  const { offer } = order;
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col">
      <header className="glass-pill mx-3 mt-3 flex items-center gap-2.5 py-2 pr-4 pl-2">
        <Link href="/" aria-label="กลับไปแชต" className={buttonClass("white", "size-11 p-0")}>
          <ArrowLeft aria-hidden="true" size={19} />
        </Link>
        <h1 className="text-base font-semibold">สรุปออเดอร์</h1>
      </header>

      <main className="flex flex-1 flex-col gap-4 px-4 py-[18px]">
        <div className="flex flex-col items-center gap-2.5 py-1.5 text-center">
          <span
            aria-hidden="true"
            className="grid size-[72px] place-items-center rounded-full text-white shadow-[0_14px_30px_rgba(122,90,224,0.35)]"
            style={{ background: "radial-gradient(circle at 30% 25%, #C4AEFB 0, #9A7CEE 50%, #7A5AE0 100%)" }}
          >
            <Check size={32} strokeWidth={2.6} />
          </span>
          <span className="text-[19px] font-semibold">ส่งออเดอร์ให้ร้านแล้ว</span>
          <span className="text-[13px] text-muted">
            {storefront.storeName} · {formatClock(order.at)}
          </span>
        </div>

        <dl className="rounded-[24px] border border-white/95 bg-white/78 px-[18px] py-1.5 shadow-[0_14px_34px_rgba(110,90,170,0.10)]">
          <Row label="สินค้า" value={order.productName} />
          <Row label="ข้อเสนอที่เลือก" value={`${offer.id} · ${offer.label}`} />
          <Row label="จำนวน × ราคา" value={`${formatQty(offer.qty)} × ${formatBaht(offer.pricePerUnit)}`} />
          <Row label="การชำระเงิน" value={formatCredit(offer.creditDays)} />
          <div className="flex items-baseline justify-between gap-3 py-3.5">
            <dt className="font-semibold">ยอดรวม</dt>
            <dd className="text-[28px] font-bold">{formatBaht(offer.total)}</dd>
          </div>
        </dl>

        <p className="text-center text-sm leading-[1.6] text-muted">
          {storefront.ownerName}จะยืนยันวันส่งของทาง {storefront.contactChannel}
        </p>

        <div className="flex items-start gap-2.5 rounded-[18px] bg-warn-bg px-3.5 py-3 text-warn-ink">
          <Shield aria-hidden="true" size={20} className="mt-0.5 shrink-0" />
          <span className="text-[13px] leading-[1.55]">
            ร้านรับโอนเข้าบัญชี {storefront.bankAccountName} เท่านั้น ถ้ามีใครขอให้โอนเข้าบัญชีอื่น อย่าโอน
          </span>
        </div>
      </main>

      <div className="flex flex-col gap-2 px-4 pt-3 pb-5">
        <Link href="/" className={buttonClass("primary", "h-[52px] text-base")}>
          กลับไปแชต
        </Link>
        {/* เปิดใช้ในเฟส 8 (Owner-Chat) — ตอนนี้ยังส่งเรื่องให้เถ้าแก่จากหน้านี้ไม่ได้ */}
        <button type="button" disabled className={buttonClass("white", "h-12 font-medium text-accent-ink shadow-none")}>
          คุยกับ{storefront.ownerName}โดยตรง
        </button>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 border-b border-dashed border-line py-3">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}
