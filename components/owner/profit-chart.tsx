import { formatQty } from "@/lib/format";
import { chartMax, type OwnerDeal } from "@/lib/owner/summary";

/** แสดงได้ไม่เกินนี้ในกราฟ (ดีลล่าสุด) — มากกว่านี้แท่งเบียดกันจนอ่านไม่ออก */
const MAX_BARS = 6;
const TICKS = 5;

const short = (n: number) => (n >= 1000 ? `${Math.round(n / 1000)}k` : String(Math.round(n)));
const pct = (v: number, max: number) => `${Math.max(0, Math.min(100, (v / max) * 100))}%`;

/** กำไรต่อดีล: ถ้ายอมลด (ฟ้า) vs ข้อเสนอที่ปิดได้ (ม่วง) — grouped bar ตาม Owner-Desktop */
export function ProfitChart({ deals }: { deals: OwnerDeal[] }) {
  const shown = deals.slice(-MAX_BARS);
  const max = chartMax(shown.flatMap((d) => [d.marginIfConceded, d.marginOffer]));
  const ticks = Array.from({ length: TICKS + 1 }, (_, i) => (max / TICKS) * (TICKS - i));
  const summary = shown.length
    ? `กำไรต่อดีล ${shown
        .map((d) => `${d.offer.id} ${d.buyerName} ถ้ายอมลด ${formatQty(Math.round(d.marginIfConceded))} บาท ข้อเสนอที่ปิดได้ ${formatQty(Math.round(d.marginOffer))} บาท`)
        .join(" · ")}`
    : "ยังไม่มีดีลวันนี้";

  return (
    <section aria-labelledby="chart-h" className="flex flex-col gap-2.5 md:glass md:gap-3.5 md:rounded-[24px] md:px-[22px] md:py-5">
      <div className="flex flex-wrap items-center justify-between gap-2.5 px-1 md:px-0">
        <div className="flex flex-col">
          <h2 id="chart-h" className="text-[17px] font-semibold md:text-lg">
            กำไรต่อดีล<span className="hidden md:inline">: ยอมลด vs ข้อเสนอของ AI</span>
          </h2>
          <span className="hidden text-[13px] text-muted md:inline">กำไรเป็นบาท ต่อดีล</span>
        </div>
        <span className="text-xs text-muted md:hidden">หน่วย: บาท</span>
        <Legend className="hidden md:flex" />
      </div>

      <div className="glass flex flex-col gap-3 rounded-[22px] p-4 md:contents">
        <Legend className="flex md:hidden" />
        {shown.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted">ยังไม่มีดีลที่ปิดได้วันนี้</p>
        ) : (
          <div role="img" aria-label={summary} className="flex gap-2.5">
            <div
              aria-hidden="true"
              className="flex h-[160px] w-[34px] flex-col justify-between text-right text-[11px] text-muted md:h-[220px]"
            >
              {ticks.map((t) => (
                <span key={t} className="leading-none">
                  {short(t)}
                </span>
              ))}
            </div>
            <div className="flex flex-1 flex-col gap-2">
              <div
                className="relative grid h-[160px] items-end border-b border-[#D6D3E6] md:h-[220px]"
                style={{ gridTemplateColumns: `repeat(${shown.length}, minmax(0, 1fr))` }}
              >
                <div aria-hidden="true" className="pointer-events-none absolute inset-0 flex flex-col justify-between">
                  {ticks.slice(0, -1).map((t) => (
                    <span key={t} className="border-t border-dashed border-[#EFEAF8]" />
                  ))}
                  <span />
                </div>
                {shown.map((d) => (
                  <div key={d.id} className="relative flex h-full items-end justify-center gap-0.5">
                    <span
                      title={`${d.buyerName} · ถ้ายอมลด ฿${formatQty(Math.round(d.marginIfConceded))}`}
                      className="w-5 rounded-t bg-chart-base md:w-[26px]"
                      style={{ height: pct(d.marginIfConceded, max) }}
                    />
                    <span
                      title={`${d.buyerName} · ข้อเสนอที่ปิดได้ ฿${formatQty(Math.round(d.marginOffer))}`}
                      className="relative w-5 rounded-t bg-chart-ai md:w-[26px]"
                      style={{ height: pct(d.marginOffer, max) }}
                    >
                      <span className="absolute bottom-full left-1/2 mb-1 -translate-x-1/2 text-[11px] font-semibold whitespace-nowrap text-ink md:text-xs">
                        {formatQty(Math.round(d.marginOffer))}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
              <div
                className="grid text-center text-xs text-ink-2 md:text-[13px]"
                style={{ gridTemplateColumns: `repeat(${shown.length}, minmax(0, 1fr))` }}
              >
                {shown.map((d) => (
                  <span key={d.id} className="truncate px-0.5">
                    {d.offer.id} · {d.buyerName}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function Legend({ className }: { className?: string }) {
  return (
    <div className={`gap-4 text-xs text-ink-2 md:text-[13px] ${className ?? "flex"}`}>
      <span className="flex items-center gap-1.5">
        <span aria-hidden="true" className="size-2.5 rounded-[3px] bg-chart-base" />
        <span>
          ถ้ายอมลด<span className="hidden md:inline">ตามที่ขอ</span>
        </span>
      </span>
      <span className="flex items-center gap-1.5">
        <span aria-hidden="true" className="size-2.5 rounded-[3px] bg-chart-ai" />
        ข้อเสนอที่ปิดได้
      </span>
    </div>
  );
}
