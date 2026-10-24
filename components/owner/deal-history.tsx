// หน้าดีลทั้งหมด (/owner/deals) — ไม่มีในไฟล์ดีไซน์ ใช้แถวแบบเดียวกับ "ดีลที่ AI ปิดได้" ของหน้าภาพรวม แยกตามวัน
import { MessageCircle } from "lucide-react";
import Link from "next/link";
import type { Offer } from "@/lib/chat/types";
import { cn } from "@/lib/cn";
import { formatBaht, formatClock, formatQty } from "@/lib/format";
import { DEAL_RANGES, groupDealsByDay, summarize, type DealRange, type OwnerDeal } from "@/lib/owner/summary";
import { signedBaht, Status } from "./deals";
import type { ConfirmOrder } from "./order-actions";
import type { MarkPaid } from "./paid-toggle";

const terms = (o: Offer) => `${formatBaht(o.pricePerUnit)} × ${formatQty(o.qty)}${o.bundle ? ` + แถม ${formatQty(o.bundle.qty)}` : ""}`;

export function DealHistory({
  deals,
  range,
  markPaid,
  confirm,
}: {
  deals: OwnerDeal[];
  range: DealRange;
  markPaid?: MarkPaid;
  confirm?: ConfirmOrder;
}) {
  // ยอดนับเมื่อได้รับเงินแล้ว (เหมือนหน้าภาพรวม) · รายการยังแสดงทุกดีลพร้อมสถานะ
  const totals = summarize(deals.filter((d) => d.paidAt));
  const groups = groupDealsByDay(deals);
  return (
    <div className="flex flex-col gap-[22px]">
      <header className="flex flex-col gap-3">
        <div className="flex flex-col">
          <h1 className="text-2xl leading-[1.35] font-semibold md:text-[28px]">ดีลทั้งหมด</h1>
          <span className="text-sm text-muted">ทุกดีลที่ผู้ช่วย AI ปิดได้ เรียงจากล่าสุด</span>
        </div>
        <nav aria-label="ช่วงวัน" className="flex w-fit flex-wrap gap-1 rounded-full bg-accent-tint/80 p-1">
          {(Object.keys(DEAL_RANGES) as DealRange[]).map((r) => (
            <Link
              key={r}
              href={`/owner/deals?range=${r}`}
              aria-current={r === range ? "page" : undefined}
              className={cn(
                "flex h-10 items-center rounded-full px-4 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                r === range ? "bg-white font-semibold text-accent-ink shadow-[0_4px_12px_rgba(110,90,170,0.14)]" : "font-medium",
              )}
            >
              {DEAL_RANGES[r]}
            </Link>
          ))}
        </nav>
      </header>

      <section aria-label={`สรุป${DEAL_RANGES[range]}`} className="grid grid-cols-[repeat(auto-fit,minmax(min(190px,100%),1fr))] gap-4">
        {[
          ["กำไรที่รักษาไว้", formatBaht(totals.recoveredTotal), "เทียบกับถ้ายอมลดตามที่ขอ"],
          ["ยอดขายที่ AI ปิดได้", formatBaht(totals.revenueTotal), `จาก ${formatQty(totals.dealCount)} ดีล`],
          ["ปิดดีลได้", `${formatQty(totals.dealCount)} ดีล`, "ทุกราคาไม่ต่ำกว่าราคาพื้น"],
        ].map(([label, value, note]) => (
          <div key={label} className="glass-clear flex flex-col gap-1.5 rounded-[22px] p-[18px]">
            <span className="text-[13px] font-medium">{label}</span>
            <span className="text-[28px] leading-[1.3] font-semibold">{value}</span>
            <span className="text-xs text-ink-2">{note}</span>
          </div>
        ))}
      </section>
      <p className="-mt-3 px-1 text-xs text-muted">
        ยอดนับเฉพาะออเดอร์ที่ได้รับเงินแล้ว · ออเดอร์ที่ยังไม่จ่ายดูได้ที่{" "}
        <Link href="/owner/orders" className="font-medium text-accent-ink hover:underline">
          หน้าออเดอร์
        </Link>
      </p>

      {groups.length === 0 ? (
        <p className="glass rounded-[22px] px-4 py-8 text-center text-sm text-muted">ยังไม่มีดีลที่ปิดได้ในช่วงนี้</p>
      ) : (
        groups.map((g) => (
          <section key={g.label} aria-label={g.label} className="flex flex-col gap-2">
            <h3 className="px-1 text-sm font-semibold text-muted">{g.label}</h3>
            <ul className="glass flex flex-col rounded-[22px] px-4 py-1">
              {g.deals.map((d, i) => (
                <li
                  key={d.id}
                  className={cn("flex flex-wrap items-center gap-x-4 gap-y-1.5 py-3.5", i > 0 && "border-t border-line-soft")}
                >
                  <span className="inline-flex size-[26px] shrink-0 items-center justify-center rounded-full bg-accent-tint text-xs font-bold text-accent-ink">
                    {d.offer.id}
                  </span>
                  <span className="flex min-w-0 flex-[1_1_200px] flex-col">
                    <span className="text-[15px] font-semibold">{d.buyerName}</span>
                    <span className="text-xs text-muted">
                      {formatClock(d.at)} · {d.productName} · {d.offer.label} · {terms(d.offer)}
                    </span>
                  </span>
                  <span className="flex flex-col items-end">
                    <span className="text-base font-bold text-accent-ink">{signedBaht(d.recoveredMargin)}</span>
                    <span className="text-xs text-muted">{formatBaht(d.offer.total)}</span>
                  </span>
                  {markPaid && <Status deal={d} markPaid={markPaid} confirm={confirm} />}
                  {d.chatId && (
                    <Link
                      href={`/owner/chats/${d.chatId}`}
                      className="flex h-10 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium text-accent-ink hover:bg-white/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                    >
                      <MessageCircle aria-hidden="true" size={15} />
                      ดูแชต<span className="sr-only">ของ{d.buyerName}</span>
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
