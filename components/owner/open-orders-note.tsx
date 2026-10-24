// หน้าภาพรวมนับรายได้เมื่อได้รับเงินแล้วเท่านั้น — ออเดอร์ที่ลูกค้าปิดดีลแล้วแต่ยังไม่จ่าย บอกไว้ตรงนี้แล้วพาไปแท็บออเดอร์
import { ArrowRight, ReceiptText } from "lucide-react";
import Link from "next/link";
import { formatBaht, formatQty } from "@/lib/format";
import type { OpenOrders } from "@/lib/owner/summary";

export function OpenOrdersNote({ openOrders: o }: { openOrders: OpenOrders }) {
  if (o.pending + o.awaiting === 0) return null;
  return (
    <section
      aria-label="ออเดอร์ที่ยังไม่ได้รับเงิน"
      className="glass flex flex-wrap items-center gap-x-4 gap-y-2 rounded-[22px] px-4 py-3"
    >
      <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-full bg-accent-tint text-accent-ink">
        <ReceiptText size={17} />
      </span>
      <span className="flex min-w-0 flex-[1_1_220px] flex-col">
        <span className="text-sm font-semibold">
          {`รอยืนยัน ${formatQty(o.pending)} · รอชำระ ${formatQty(o.awaiting)} (${formatBaht(o.awaitingTotal)})`}
        </span>
        <span className="text-xs text-muted">ออเดอร์ที่ลูกค้าปิดดีลแล้ว นับเป็นรายได้เมื่อได้รับเงินแล้ว</span>
      </span>
      <Link
        href="/owner/orders"
        className="flex h-10 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold text-accent-ink hover:bg-white/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        ไปหน้าออเดอร์
        <ArrowRight aria-hidden="true" size={15} />
      </Link>
    </section>
  );
}
