import Link from "next/link";
import type { Offer } from "@/lib/chat/types";
import { formatBaht, formatClock, formatQty } from "@/lib/format";
import type { OwnerDeal } from "@/lib/owner/summary";
import { OrderActions, type ConfirmOrder } from "./order-actions";
import { PaidToggle, type MarkPaid } from "./paid-toggle";

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

/**
 * ดีลที่ AI ปิดได้ — คอม = ตาราง (ไม่มีคอลัมน์ Deal score) · มือถือ = รายการ
 * markPaid = มีคอลัมน์สถานะ + ปุ่มได้รับเงินแล้ว · confirm ด้วย = ปุ่มยืนยันออเดอร์ก่อน (รอยืนยัน → รอชำระ → ชำระแล้ว)
 */
export function Deals({ deals, markPaid, confirm }: { deals: OwnerDeal[]; markPaid?: MarkPaid; confirm?: ConfirmOrder }) {
  const latestFirst = [...deals].reverse();
  return (
    <section
      id="deals"
      aria-labelledby="deal-h"
      className="flex scroll-mt-6 flex-col gap-2.5 md:glass md:gap-1.5 md:rounded-[24px] md:px-4 md:pt-[18px] md:pb-2"
    >
      <div className="flex items-center justify-between gap-3 px-1 md:px-1.5">
        <h2 id="deal-h" className="text-[17px] font-semibold md:text-lg">
          ดีลที่ AI ปิดได้
        </h2>
        <Link href="/owner/deals" className="text-sm font-medium text-accent-ink hover:underline">
          ดูทั้งหมด
        </Link>
      </div>

      {deals.length === 0 ? (
        <p className="glass rounded-[22px] px-4 py-6 text-center text-sm text-muted md:bg-transparent md:shadow-none md:[backdrop-filter:none] md:border-0">
          ยังไม่มีดีลที่ได้รับเงินวันนี้
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
                  {markPaid && (
                    <th scope="col" className="border-b border-line-soft px-3.5 py-[13px] text-left font-medium whitespace-nowrap">
                      สถานะ
                    </th>
                  )}
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
                    {markPaid && (
                      <td>
                        <Status deal={d} markPaid={markPaid} confirm={confirm} />
                      </td>
                    )}
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
                {markPaid && (
                  <span className="col-start-2 col-end-4 pt-1">
                    <Status deal={d} markPaid={markPaid} confirm={confirm} />
                  </span>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

/** มีปุ่มยืนยัน → ทีละขั้นตามสถานะ · ไม่มี → ปุ่มได้รับเงินแบบเดิม */
export function Status({ deal: d, markPaid, confirm }: { deal: OwnerDeal; markPaid: MarkPaid; confirm?: ConfirmOrder }) {
  if (!confirm) return <PaidToggle orderId={d.id} buyerName={d.buyerName} paidAt={d.paidAt} markPaid={markPaid} />;
  return (
    <OrderActions
      orderId={d.id}
      buyerName={d.buyerName}
      confirmedAt={d.confirmedAt}
      paidAt={d.paidAt}
      confirm={confirm}
      markPaid={markPaid}
    />
  );
}
