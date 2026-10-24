import { Check, Shield, TrendingUp } from "lucide-react";
import type { ReactNode } from "react";
import { formatBaht, formatQty } from "@/lib/format";
import type { OwnerTotals } from "@/lib/owner/summary";

function IconChip({ className, children }: { className: string; children: ReactNode }) {
  return (
    <span aria-hidden="true" className={`flex size-[26px] items-center justify-center rounded-lg ${className}`}>
      {children}
    </span>
  );
}

function Tile({ icon, label, value, note }: { icon: ReactNode; label: string; value: string; note: string }) {
  return (
    <div className="glass-clear flex flex-col gap-1.5 rounded-[22px] p-[18px]">
      <span className="flex items-center gap-2 text-[13px] font-medium">
        {icon}
        {label}
      </span>
      <span className="text-[30px] leading-[1.3] font-semibold">{value}</span>
      <span className="text-xs text-ink-2">{note}</span>
    </div>
  );
}

const recoveredIcon = (
  <IconChip className="bg-tile-lavender text-accent-ink">
    <Shield size={14} strokeWidth={2.2} />
  </IconChip>
);

/** คอม = 3 การ์ดเรียงกัน · มือถือ = การ์ดเดียว ตัวเลขกำไรใหญ่สุด (SKILL §10 ข้อ 4) */
export function StatTiles({ totals }: { totals: OwnerTotals }) {
  const deals = `${formatQty(totals.dealCount)} ดีล`;
  return (
    <>
      <div className="hidden grid-cols-[repeat(auto-fit,minmax(min(190px,100%),1fr))] gap-4 md:grid">
        <Tile
          icon={recoveredIcon}
          label="กำไรที่รักษาไว้"
          value={formatBaht(totals.recoveredTotal)}
          note="เทียบกับถ้ายอมลดตามที่ขอ"
        />
        <Tile
          icon={
            <IconChip className="bg-tile-blue text-[#1F5F99]">
              <TrendingUp size={14} strokeWidth={2.2} />
            </IconChip>
          }
          label="ยอดขายที่ AI ปิดได้"
          value={formatBaht(totals.revenueTotal)}
          note={`ได้รับเงินแล้ว ${deals}วันนี้`}
        />
        <Tile
          icon={
            <IconChip className="bg-tile-mint text-ok-ink">
              <Check size={14} strokeWidth={2.4} />
            </IconChip>
          }
          label="ปิดดีลได้"
          value={deals}
          note="ทุกราคาไม่ต่ำกว่าราคาพื้น"
        />
      </div>

      <section aria-label="สรุปวันนี้" className="glass-clear flex flex-col gap-3.5 rounded-[24px] p-5 md:hidden">
        <div className="flex flex-col gap-0.5">
          <span className="flex items-center gap-2 text-[13px] font-medium">
            {recoveredIcon}
            กำไรที่รักษาไว้
          </span>
          <span className="text-[42px] leading-[1.3] font-semibold">{formatBaht(totals.recoveredTotal)}</span>
          <span className="text-xs text-ink-2">เทียบกับถ้ายอมลดตามที่ลูกค้าขอทุกดีล</span>
        </div>
        <div className="grid grid-cols-2 border-t border-white/80 pt-3.5">
          <div className="flex flex-col border-r border-white/80 pr-3">
            <span className="flex items-center gap-1.5 text-xs text-ink-2">
              <span aria-hidden="true" className="size-2 rounded-full bg-chart-base" />
              ยอดขายที่ AI ปิด
            </span>
            <span className="text-xl leading-[1.45] font-semibold">{formatBaht(totals.revenueTotal)}</span>
          </div>
          <div className="flex flex-col pl-3.5">
            <span className="flex items-center gap-1.5 text-xs text-ink-2">
              <span aria-hidden="true" className="size-2 rounded-full bg-[#2E9E6B]" />
              ปิดดีลได้
            </span>
            <span className="text-xl leading-[1.45] font-semibold">{deals}</span>
          </div>
        </div>
      </section>
    </>
  );
}
