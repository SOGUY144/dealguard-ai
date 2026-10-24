// แท็บออเดอร์และชำระเงิน (/owner/orders) — ไม่มีในไฟล์ดีไซน์ (ทีมขอเพิ่ม 25 ต.ค. 2569)
// ลูกค้าปิดดีลแล้ว: เถ้าแก่ยืนยันออเดอร์ → ลูกค้าเห็น QR → เงินเข้า กดได้รับเงินแล้ว โดยไม่ต้องเข้าไปในแชต
import { MessageCircle, QrCode } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { formatBaht, formatClock, formatCredit, formatQty, thaiDate } from "@/lib/format";
import type { OwnerDeal } from "@/lib/owner/summary";
import { OrderActions, type ConfirmOrder } from "./order-actions";
import type { MarkPaid } from "./paid-toggle";

const DAY_MS = 24 * 60 * 60 * 1000;

type Board = { pending: OwnerDeal[]; awaiting: OwnerDeal[]; paid: OwnerDeal[] };
type Props = { board: Board; confirm: ConfirmOrder; markPaid: MarkPaid };

export function OrderBoard({ board, confirm, markPaid }: Props) {
  return (
    <div className="flex flex-col gap-[22px]">
      <header className="flex flex-col">
        <h1 className="text-2xl leading-[1.35] font-semibold md:text-[28px]">ออเดอร์และชำระเงิน</h1>
        <span className="text-sm text-muted">ลูกค้าปิดดีลกับ AI แล้ว · ยืนยันออเดอร์ให้ลูกค้าเห็น QR แล้วกดได้รับเงินเมื่อเงินเข้า</span>
      </header>
      <div className="grid gap-[22px] md:grid-cols-3 md:items-start">
        <Column
          title="รอยืนยัน"
          hint="ยืนยันแล้วลูกค้าจะเห็น QR สำหรับจ่าย"
          empty="ไม่มีออเดอร์รอยืนยัน"
          deals={board.pending}
          tone="warn"
          render={(d) => <Card deal={d} confirm={confirm} markPaid={markPaid} />}
        />
        <Column
          title="รอชำระ"
          hint="เช็กยอดในแอปธนาคารแล้วกดได้รับเงิน"
          empty="ไม่มีออเดอร์รอชำระ"
          deals={board.awaiting}
          tone="accent"
          render={(d) => <Card deal={d} confirm={confirm} markPaid={markPaid} />}
        />
        <Column
          title="ชำระแล้ววันนี้"
          empty="วันนี้ยังไม่มีออเดอร์ที่ชำระแล้ว"
          deals={board.paid}
          tone="ok"
          footer={
            <Link href="/owner/deals" className="px-1 text-sm font-medium text-accent-ink hover:underline">
              ดูดีลทั้งหมด
            </Link>
          }
          render={(d) => <Card deal={d} confirm={confirm} markPaid={markPaid} />}
        />
      </div>
    </div>
  );
}

const TONE = { warn: "bg-warn", accent: "bg-accent", ok: "bg-ok-ink" } as const;

function Column({
  title,
  hint,
  empty,
  deals,
  tone,
  footer,
  render,
}: {
  title: string;
  hint?: string;
  empty: string;
  deals: OwnerDeal[];
  tone: keyof typeof TONE;
  footer?: ReactNode;
  render: (d: OwnerDeal) => ReactNode;
}) {
  return (
    <section aria-label={`${title} ${formatQty(deals.length)} ออเดอร์`} className="flex flex-col gap-2.5">
      <div className="flex flex-col px-1">
        <h2 className="flex items-center gap-2 text-[17px] font-semibold">
          <span aria-hidden="true" className={cn("size-2 rounded-full", TONE[tone])} />
          {title}
          <span className="rounded-full bg-white/80 px-2 py-0.5 text-xs font-semibold text-ink-2">{formatQty(deals.length)}</span>
        </h2>
        {hint && <span className="text-xs text-muted">{hint}</span>}
      </div>
      {deals.length === 0 ? (
        <p className="glass rounded-[22px] px-4 py-6 text-center text-sm text-muted">{empty}</p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {deals.map((d) => (
            <li key={d.id} className="glass flex flex-col gap-2.5 rounded-[22px] px-4 py-3.5">
              {render(d)}
            </li>
          ))}
        </ul>
      )}
      {footer}
    </section>
  );
}

function Card({ deal: d, confirm, markPaid }: { deal: OwnerDeal; confirm: ConfirmOrder; markPaid: MarkPaid }) {
  const { offer } = d;
  const due = offer.creditDays > 0 ? ` · ครบ ${thaiDate(new Date(Date.parse(d.at) + offer.creditDays * DAY_MS))}` : "";
  const link =
    "flex h-10 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium text-accent-ink hover:bg-white/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <span className="flex min-w-0 flex-col">
          <span className="text-[15px] font-semibold">{d.buyerName}</span>
          <span className="text-xs text-muted">
            {formatClock(d.at)} · {d.productName}
          </span>
        </span>
        <span className="text-base font-bold whitespace-nowrap">{formatBaht(offer.total)}</span>
      </div>
      <span className="text-[13px] leading-[1.5] text-ink-2">
        {offer.id} · {offer.label} · {formatBaht(offer.pricePerUnit)} × {formatQty(offer.qty)}
        {offer.bundle ? ` + แถม ${offer.bundle.name} ${formatQty(offer.bundle.qty)}` : ""}
        <span className="block">
          {formatCredit(offer.creditDays)}
          {due}
        </span>
      </span>
      <OrderActions
        orderId={d.id}
        buyerName={d.buyerName}
        confirmedAt={d.confirmedAt}
        paidAt={d.paidAt}
        confirm={confirm}
        markPaid={markPaid}
      />
      <span className="-mx-2 -mb-1 flex flex-wrap gap-1">
        {d.chatId && (
          <Link href={`/owner/chats/${d.chatId}`} className={link}>
            <MessageCircle aria-hidden="true" size={15} />
            ดูแชต<span className="sr-only">ของ{d.buyerName}</span>
          </Link>
        )}
        {/* เถ้าแก่เปิดใบสรุปของลูกค้าได้ (RLS) — เห็น QR แบบเดียวกับที่ลูกค้าเห็น */}
        <Link href={`/order/${d.id}`} aria-label={`ใบสรุป / QR ของ${d.buyerName}`} className={link}>
          <QrCode aria-hidden="true" size={15} />
          ใบสรุป / QR
        </Link>
      </span>
    </>
  );
}
