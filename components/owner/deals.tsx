import type { Offer } from "@/lib/chat/types";
import { formatBaht, formatClock, formatQty } from "@/lib/format";
import type { OwnerDeal } from "@/lib/owner/summary";

/** "+฿20,000" · ติดลบแสดง "−฿…" */
export function signedBaht(n: number): string {
  const rounded = Math.round(n);
  return `${rounded < 0 ? "−" : "+"}${formatBaht(Math.abs(rounded))}`;
}

const terms = (o: Offer) =>
  `${formatBaht(o.pricePerUnit)} × ${formatQty(o.qty)}${o.bundle ? ` + แถม ${formatQty(o.bundle.qty)}` : ""}`;

function Letter({ id }: { id: Offer["id"] }) {
  return (
    <span className="inline-flex size-[26px] shrink-0 items-center justify-center rounded-full bg-accent-tint text-xs font-bold text-accent-ink">
      {id}
    </span>
  );
}

/** ดีลที่ AI ปิดได้ — คอม = ตาราง (ไม่มีคอลัมน์ Deal score) · มือถือ = รายการ */
export function Deals({ deals }: { deals: OwnerDeal[] }) {
  const latestFirst = [...deals].reverse();
  return (
    <section
      id="deals"
      aria-labelledby="deal-h"
      className="flex scroll-mt-6 flex-col gap-2.5 md:glass md:gap-1.5 md:rounded-[24px] md:px-4 md:pt-[18px] md:pb-2"
    >
      <h2 id="deal-h" className="px-1 text-[17px] font-semibold md:px-1.5 md:text-lg">
        ดีลที่ AI ปิดได้
      </h2>

      {deals.length === 0 ? (
        <p className="glass rounded-[22px] px-4 py-6 text-center text-sm text-muted md:bg-transparent md:shadow-none md:[backdrop-filter:none] md:border-0">
          ยังไม่มีดีลที่ปิดได้วันนี้
        </p>
      ) : (
        <>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="text-[13px] text-muted">
                  {["เวลา", "ลูกค้า", "ข้อเสนอ", "ราคา × จำนวน", "ยอดขาย"].map((h) => (
                    <th key={h} scope="col" className="border-b border-line-soft px-3.5 py-[13px] text-left font-medium whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                  <th scope="col" className="border-b border-line-soft px-3.5 py-[13px] text-right font-medium whitespace-nowrap">
                    กำไรที่รักษาไว้
                  </th>
                </tr>
              </thead>
              <tbody>
                {latestFirst.map((d) => (
                  <tr key={d.id} className="[&>td]:border-b [&>td]:border-line-soft [&>td]:px-3.5 [&>td]:py-[13px] [&>td]:whitespace-nowrap">
                    <td className="text-muted">{formatClock(d.at)}</td>
                    <td className="font-medium">{d.buyerName}</td>
                    <td>
                      <span className="inline-flex items-center gap-2">
                        <Letter id={d.offer.id} />
                        {d.offer.label}
                      </span>
                    </td>
                    <td>{terms(d.offer)}</td>
                    <td>{formatBaht(d.offer.total)}</td>
                    <td className="text-right font-bold text-accent-ink">{signedBaht(d.recoveredMargin)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="glass flex flex-col rounded-[22px] px-4 py-1 md:hidden">
            {latestFirst.map((d, i) => (
              <li
                key={d.id}
                className={`grid grid-cols-[36px_1fr_auto] items-center gap-x-3 py-3 ${i > 0 ? "border-t border-line-soft" : ""}`}
              >
                <span className="row-span-2">
                  <Letter id={d.offer.id} />
                </span>
                <span className="text-[15px] font-semibold">{d.buyerName}</span>
                <span className="text-right text-base font-bold text-accent-ink">{signedBaht(d.recoveredMargin)}</span>
                <span className="text-xs text-muted">
                  {formatClock(d.at)} · {d.offer.label} · {formatQty(d.offer.qty)} ชิ้น
                </span>
                <span className="text-right text-xs text-muted">{formatBaht(d.offer.total)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
