// หน้ารอตัดสิน (/owner/escalations) — ทุกเรื่องที่ AI ส่งให้เถ้าแก่ ไม่ใช่แค่วันนี้ · ไม่มีในไฟล์ดีไซน์ ใช้การ์ดแบบหน้าภาพรวม
import { MessageCircle, Reply } from "lucide-react";
import Link from "next/link";
import { buttonClass } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { formatClock, thaiDate } from "@/lib/format";
import { escalationLabel, type EscalationEntry } from "@/lib/owner/summary";

type Props = { entries: EscalationEntry[]; status: "open" | "resolved"; openCount: number };

export function EscalationHistory({ entries, status, openCount }: Props) {
  const tabs = [
    { value: "open", label: "รอตัดสิน" },
    { value: "resolved", label: "ปิดแล้ว" },
  ] as const;
  return (
    <div className="flex flex-col gap-[22px]">
      <header className="flex flex-col gap-3">
        <div className="flex flex-col">
          <h1 className="text-2xl leading-[1.35] font-semibold md:text-[28px]">เรื่องที่ส่งให้เถ้าแก่</h1>
          <span className="text-sm text-muted">AI หยุดตอบในแชตเหล่านี้ ตอบเอง ปิดเรื่อง หรือให้ AI ตอบต่อได้ในหน้าแชต</span>
        </div>
        <nav aria-label="สถานะ" className="flex w-fit gap-1 rounded-full bg-accent-tint/80 p-1">
          {tabs.map((t) => (
            <Link
              key={t.value}
              href={`/owner/escalations?status=${t.value}`}
              aria-current={t.value === status ? "page" : undefined}
              className={cn(
                "flex h-10 items-center gap-2 rounded-full px-4 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                t.value === status ? "bg-white font-semibold text-accent-ink shadow-[0_4px_12px_rgba(110,90,170,0.14)]" : "font-medium",
              )}
            >
              {t.label}
              {t.value === "open" && openCount > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-warn px-1.5 text-[11px] font-semibold text-white">
                  {openCount}
                  <span className="sr-only"> เรื่องวันนี้</span>
                </span>
              )}
            </Link>
          ))}
        </nav>
      </header>

      {entries.length === 0 ? (
        <p className="glass rounded-[22px] px-4 py-8 text-center text-sm text-muted">
          {status === "open" ? "ไม่มีเรื่องที่รอตัดสิน" : "ยังไม่มีเรื่องที่ปิดแล้ว"}
        </p>
      ) : (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(320px,100%),1fr))] gap-3.5">
          {entries.map((e) => (
            <li key={e.id} className="glass flex flex-col gap-2.5 rounded-[22px] p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span
                  className={cn(
                    "rounded-full px-2.5 py-1 text-xs font-semibold",
                    e.status === "open" ? "bg-warn-bg text-warn-ink" : "bg-ok-bg text-ok-ink",
                  )}
                >
                  {escalationLabel(e.kind)}
                </span>
                <span className="text-xs text-muted">
                  {thaiDate(new Date(e.at))} · {formatClock(e.at)}
                </span>
              </div>
              <span className="text-[15px] font-semibold">{e.buyerName}</span>
              <ul className="flex flex-col gap-0.5 text-sm leading-[1.6]">
                {e.brief.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
              {e.status === "open" ? (
                <Link href={`/owner/chats/${e.chatId}#reply`} className={buttonClass("primary", "h-[42px] min-h-0 text-sm")}>
                  <Reply aria-hidden="true" size={15} />
                  ตอบ<span className="sr-only">{e.buyerName}</span>
                </Link>
              ) : (
                <Link href={`/owner/chats/${e.chatId}`} className={buttonClass("secondary", "h-[42px] min-h-0 text-sm font-medium")}>
                  <MessageCircle aria-hidden="true" size={15} />
                  ดูแชต<span className="sr-only">ของ{e.buyerName}</span>
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
