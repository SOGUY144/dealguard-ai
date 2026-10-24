import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { bangkokDayStart, formatClock } from "@/lib/format";
import type { ActiveChat, ActiveChatStatus } from "@/lib/owner/summary";
import { ChatAvatar } from "./chat-avatar";

const STATUS: Record<ActiveChatStatus, { label: string; className: string }> = {
  ai: { label: "AI กำลังคุย", className: "bg-accent-tint text-accent-ink" },
  owner: { label: "เถ้าแก่ดูแล", className: "bg-warn-bg text-warn-ink" },
  ordered: { label: "ปิดดีลแล้ว", className: "bg-ok-bg text-ok-ink" },
};

const SHORT_DATE = new Intl.DateTimeFormat("th-TH", { timeZone: "Asia/Bangkok", day: "numeric", month: "short" });

/** วันนี้ → "10:00" · วันก่อน → "24 ต.ค." (รายการมีแชตเก่ากว่าวันนี้ด้วย) */
function whenLabel(iso: string, now: Date): string {
  const at = new Date(iso);
  return bangkokDayStart(at).getTime() === bangkokDayStart(now).getTime() ? formatClock(iso) : SHORT_DATE.format(at);
}

/**
 * แชตที่กำลังคุย (ไม่มีในไฟล์ดีไซน์ — ทีมขอเพิ่ม 24 ต.ค. 2569 · 25 ต.ค. ทำเป็นรายการแบบ Messenger)
 * ให้เถ้าแก่เห็นทุกแชต ล่าสุดก่อน เลื่อนดูในกล่องได้ และกดเข้าไปดู/ตอบเองได้ก่อน AI ส่งเรื่องมา
 */
export function ActiveChats({ chats, now = new Date() }: { chats: ActiveChat[]; now?: Date }) {
  return (
    <section id="chats" aria-labelledby="chats-h" className="flex scroll-mt-6 flex-col gap-2.5">
      <h2 id="chats-h" className="flex items-baseline gap-2 px-1 text-[17px] font-semibold">
        แชตที่กำลังคุย
        {chats.length > 0 && <span className="text-sm font-normal text-muted">{chats.length} แชต</span>}
      </h2>
      {chats.length === 0 ? (
        <p className="glass rounded-[22px] px-4 py-6 text-center text-sm text-muted">ยังไม่มีแชต</p>
      ) : (
        // ยาวลงมาได้เกือบเต็มจอ เกินนั้นเลื่อนในกล่อง (หน้าไม่ยาวไม่จบ)
        <ul className="glass flex max-h-[min(70dvh,640px)] flex-col overflow-y-auto overscroll-contain rounded-[22px] px-2 py-1">
          {chats.map((c, i) => {
            const status = STATUS[c.status];
            return (
              <li key={c.chatId} className={i > 0 ? "border-t border-line-soft" : undefined}>
                <Link
                  href={`/owner/chats/${c.chatId}`}
                  className="flex min-h-14 items-center gap-3 rounded-2xl px-2 py-2.5 hover:bg-white/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  <span className="relative shrink-0">
                    <ChatAvatar chatId={c.chatId} name={c.buyerName} className="size-11 text-sm" />
                    {c.status === "owner" && (
                      <span
                        aria-hidden="true"
                        className="absolute -right-0.5 -bottom-0.5 size-3.5 rounded-full border-2 border-white bg-warn"
                      />
                    )}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-sm font-semibold">{c.buyerName}</span>
                      <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold", status.className)}>
                        {status.label}
                      </span>
                    </span>
                    <span className={cn("truncate text-[13px]", c.status === "owner" ? "font-medium text-ink" : "text-muted")}>
                      {c.preview}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs text-muted">{whenLabel(c.at, now)}</span>
                  <ChevronRight aria-hidden="true" size={16} className="shrink-0 text-muted" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
