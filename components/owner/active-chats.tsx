import { ChevronRight, User } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { formatClock } from "@/lib/format";
import type { ActiveChat, ActiveChatStatus } from "@/lib/owner/summary";

const STATUS: Record<ActiveChatStatus, { label: string; className: string }> = {
  ai: { label: "AI กำลังคุย", className: "bg-accent-tint text-accent-ink" },
  owner: { label: "เถ้าแก่ดูแล", className: "bg-warn-bg text-warn-ink" },
  ordered: { label: "ปิดดีลแล้ว", className: "bg-ok-bg text-ok-ink" },
};

/**
 * แชตที่กำลังคุย (ไม่มีในไฟล์ดีไซน์ — ทีมขอเพิ่ม 24 ต.ค. 2569 รายละเอียดจะปรับอีกที)
 * ให้เถ้าแก่เห็นแชตที่ AI ยังคุยอยู่ และกดเข้าไปดู/ตอบเองได้ก่อน AI ส่งเรื่องมา
 */
export function ActiveChats({ chats }: { chats: ActiveChat[] }) {
  return (
    <section id="chats" aria-labelledby="chats-h" className="flex scroll-mt-6 flex-col gap-2.5">
      <h2 id="chats-h" className="px-1 text-[17px] font-semibold">
        แชตที่กำลังคุย
      </h2>
      {chats.length === 0 ? (
        <p className="glass rounded-[22px] px-4 py-6 text-center text-sm text-muted">ยังไม่มีแชตวันนี้</p>
      ) : (
        <ul className="glass flex flex-col rounded-[22px] px-2 py-1">
          {chats.map((c, i) => {
            const status = STATUS[c.status];
            return (
              <li key={c.chatId} className={i > 0 ? "border-t border-line-soft" : undefined}>
                <Link
                  href={`/owner/chats/${c.chatId}`}
                  className="flex min-h-14 items-center gap-3 rounded-2xl px-2 py-2.5 hover:bg-white/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#EEF1FB] text-[#4A4C63]">
                    <User size={17} />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-sm font-semibold">{c.buyerName}</span>
                      <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold", status.className)}>
                        {status.label}
                      </span>
                    </span>
                    <span className="truncate text-[13px] text-muted">{c.preview}</span>
                  </span>
                  <span className="shrink-0 text-xs text-muted">{formatClock(c.at)}</span>
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
