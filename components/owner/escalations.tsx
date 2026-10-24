import { AlertCircle } from "lucide-react";
import Link from "next/link";
import { buttonClass } from "@/components/ui/button";
import { formatClock, formatDayLabel } from "@/lib/format";
import { escalationLabel, type OwnerEscalation } from "@/lib/owner/summary";

type Props = {
  escalations: OwnerEscalation[];
  /** จำนวนจริง (รายการอาจถูกตัดให้สั้น) */
  openCount: number;
  ownerName: string;
};

const chatHref = (e: OwnerEscalation) => `/owner/chats/${e.chatId}`;
/** เรื่องค้างจากวันก่อนบอกวันที่ด้วย */
const when = (at: string) => {
  const day = formatDayLabel(at, new Date());
  return day === "วันนี้" ? formatClock(at) : `${day} ${formatClock(at)}`;
};

/** เรื่องที่ AI หยุดตอบและส่งให้เถ้าแก่ (ส้ม = ต้องให้เถ้าแก่ตัดสินเท่านั้น) */
export function Escalations({ escalations, openCount: count, ownerName }: Props) {
  return (
    <section id="escalations" aria-labelledby="esc-h" className="flex scroll-mt-6 flex-col gap-2.5 md:gap-3.5">
      <div className="flex items-center gap-2 px-1 md:hidden">
        <h2 id="esc-h" className="text-[17px] font-semibold">
          รอเถ้าแก่ตัดสิน
        </h2>
        {count > 0 && (
          <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-warn px-[7px] text-xs font-semibold text-white">
            {count}
          </span>
        )}
      </div>

      <div className="glass-clear hidden flex-col gap-1.5 rounded-[24px] p-5 text-warn-ink md:flex">
        <span className="text-[13px]" aria-hidden="true">
          รอเถ้าแก่ตัดสิน
        </span>
        <span className="text-[28px] leading-[1.3] font-semibold">
          <span className="sr-only">รอเถ้าแก่ตัดสิน </span>
          {count} เรื่อง
        </span>
        <span className="text-[13px] leading-[1.5]">AI หยุดตอบในแชตเหล่านี้ และส่งเรื่องให้{ownerName}ตัดสินเอง</span>
      </div>

      <Link href="/owner/escalations" className="self-end px-1 text-sm font-medium text-accent-ink hover:underline">
        ดูทั้งหมด<span className="sr-only">เรื่องที่ส่งให้เถ้าแก่</span>
      </Link>
      {escalations.length === 0 ? (
        <p className="glass rounded-[22px] px-4 py-6 text-center text-sm text-muted">ไม่มีเรื่องที่รอตัดสิน</p>
      ) : (
        <>
          <ul className="hidden flex-col gap-3.5 md:flex">
            {escalations.map((e) => (
              <li key={e.id} className="glass flex flex-col gap-2.5 rounded-[22px] p-4">
                <div className="flex items-center justify-between">
                  <span className="rounded-full bg-warn-bg px-2.5 py-1 text-xs font-semibold text-warn-ink">
                    {escalationLabel(e.kind)}
                  </span>
                  <span className="text-xs text-muted">{when(e.at)}</span>
                </div>
                <p className="text-sm leading-[1.6]">{e.brief.join(" · ")}</p>
                <div className="grid grid-cols-2 gap-2">
                  {/* ตอบเอง = ไปที่ช่องพิมพ์เลย · ดูแชต = เปิดดูประวัติก่อน (หน้าเดียวกัน) */}
                  <Link href={`${chatHref(e)}#reply`} aria-label="ตอบเอง" className={buttonClass("primary", "h-[42px] min-h-0 text-sm")}>
                    ตอบเอง
                  </Link>
                  <Link href={chatHref(e)} className={buttonClass("secondary", "h-[42px] min-h-0 text-sm font-medium")}>
                    ดูแชต
                  </Link>
                </div>
              </li>
            ))}
          </ul>

          <ul className="glass flex flex-col rounded-[22px] px-4 py-1 md:hidden">
            {escalations.map((e, i) => (
              <li key={e.id} className={`flex items-center gap-3 py-3 ${i > 0 ? "border-t border-line-soft" : ""}`}>
                <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-warn-bg text-warn">
                  <AlertCircle size={18} />
                </span>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="text-xs font-semibold text-warn-ink">
                    {escalationLabel(e.kind)} · {when(e.at)}
                  </span>
                  <span className="text-sm leading-[1.5]">{e.brief[0]}</span>
                </div>
                <Link href={`${chatHref(e)}#reply`} className={buttonClass("primary", "h-10 min-h-0 px-4 text-[13px]")}>
                  ตอบ
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
