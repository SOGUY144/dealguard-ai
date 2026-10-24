"use client";

// หัวแชตลอยแบบ Messenger (ทุกหน้าเถ้าแก่ อยู่ใน app/owner/layout.tsx): ลูกค้าทักมา → วงกลมเด้งขึ้นมุมจอ กดแล้วเข้าแชตเลย
// ฟัง Realtime (ข้อความใหม่ / ส่งเรื่อง) แล้วถามแชตล่าสุดจาก server · กติกาว่าอะไรเด้งอยู่ใน lib/owner/chat-heads.ts
import { X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useReducer, useRef } from "react";
import { useLiveUpdates, type ConnectLive } from "@/components/live/use-live-updates";
import { cn } from "@/lib/cn";
import {
  dropHead,
  EMPTY_HEADS,
  mergeHeads,
  quietHead,
  type ChatHead,
  type ChatHeadSource,
  type HeadsState,
} from "@/lib/owner/chat-heads";
import { connectOwnerDashboard } from "@/lib/supabase/live";
import { ChatAvatar } from "./chat-avatar";

/** วงกลมที่โชว์พร้อมกัน ที่เหลือรวมเป็น +N */
const VISIBLE = 4;
/** กล่องข้อความข้างวงกลมหายไปเองหลังจากนี้ */
const PEEK_MS = 6_000;

type Action =
  | { type: "merge"; sources: ChatHeadSource[]; open: string | null }
  | { type: "quiet"; chatIds: string[] }
  | { type: "drop"; chatId: string };

function reducer(state: HeadsState, action: Action): HeadsState {
  switch (action.type) {
    case "merge":
      return mergeHeads(state, action.sources, action.open);
    case "quiet":
      return action.chatIds.reduce(quietHead, state);
    case "drop":
      return dropHead(state, action.chatId);
  }
}

/** /owner/chats/<id> → id ของแชตที่เปิดอยู่ */
export function openChatOf(pathname: string | null): string | null {
  return pathname?.match(/^\/owner\/chats\/([^/?#]+)/)?.[1] ?? null;
}

type Props = {
  /** null = อ่านไม่ได้ตอนนี้ (ข้ามรอบนี้) */
  load: () => Promise<ChatHeadSource[] | null>;
  connect?: ConnectLive;
};

export function ChatHeads({ load, connect = connectOwnerDashboard }: Props) {
  const open = openChatOf(usePathname());
  const [state, dispatch] = useReducer(reducer, EMPTY_HEADS);
  const openRef = useRef(open);
  // load เป็น server action ที่ layout ส่งมา — ได้ตัวใหม่ทุกครั้งที่ Next render ใหม่หลัง server action (รวม load เอง)
  // ถ้าดึงใหม่ทุกครั้งที่ได้ตัวใหม่จะวนเรียกไม่หยุด (เพื่อนเจอกับการแจ้งเตือนออเดอร์ ~3 ครั้ง/วินาที) → เก็บตัวล่าสุดไว้ใน ref
  const latestLoad = useRef(load);
  useEffect(() => {
    openRef.current = open;
    latestLoad.current = load;
  }, [open, load]);

  const refresh = useCallback(() => {
    latestLoad.current().then(
      (sources) => sources && dispatch({ type: "merge", sources, open: openRef.current }),
      () => {},
    );
  }, []);

  // ดึงตอนเปิดหน้า และทุกครั้งที่เข้า/ออกหน้าแชต (แชตที่เพิ่งเปิดดู = อ่านแล้ว ไม่เด้งกลับมา) — ไม่ใช่ทุกครั้งที่ load เปลี่ยน
  useEffect(() => refresh(), [refresh, open]);
  useLiveUpdates(connect, refresh);

  // กล่องข้อความหายเองหลังจากนี้ · ข้อความใหม่เข้ามาอีก = นับเวลาใหม่
  const peeking = state.heads
    .filter((h) => h.peek)
    .map((h) => `${h.chatId}:${h.unread}`)
    .join("|");
  useEffect(() => {
    if (!peeking) return;
    const chatIds = peeking.split("|").map((k) => k.split(":")[0]);
    const timer = setTimeout(() => dispatch({ type: "quiet", chatIds }), PEEK_MS);
    return () => clearTimeout(timer);
  }, [peeking]);

  const shown = state.heads.filter((h) => h.chatId !== open);
  const visible = shown.slice(0, VISIBLE);
  const extra = shown.length - visible.length;

  return (
    <div
      role="region"
      aria-label="ลูกค้าที่ทักเข้ามา"
      aria-live="polite"
      className={cn(
        // ใหม่สุดอยู่ล่างสุด (ใกล้นิ้ว) เรียงขึ้นไปแบบ Messenger · ไม่บังเมนูล่าง / ช่องพิมพ์ในหน้าแชต (มือถือ)
        "pointer-events-none fixed right-3 z-30 flex flex-col-reverse items-end gap-3 md:top-auto md:right-6 md:bottom-6",
        open ? "top-[22%]" : "bottom-[calc(96px+env(safe-area-inset-bottom))]",
      )}
    >
      {visible.map((h) => (
        <Head key={h.chatId} head={h} onLeave={() => dispatch({ type: "drop", chatId: h.chatId })} />
      ))}
      {extra > 0 && (
        <Link
          href="/owner#chats"
          className="pointer-events-auto mr-1.5 grid size-11 place-items-center rounded-full bg-white/95 text-sm font-semibold text-ink-2 shadow-[0_8px_20px_rgba(70,50,140,0.22)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          +{extra}
          <span className="sr-only"> แชต ดูทั้งหมด</span>
        </Link>
      )}
    </div>
  );
}

function Head({ head: h, onLeave }: { head: ChatHead; onLeave: () => void }) {
  const href = `/owner/chats/${h.chatId}`;
  const label = [
    `เปิดแชต ${h.buyerName}`,
    h.unread > 0 ? `${h.unread} ข้อความใหม่: ${h.preview}` : null,
    h.needsOwner ? `รอคุณตัดสิน${h.subject ? ` (${h.subject})` : ""}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="group flex items-center gap-2.5 motion-safe:animate-[sheet-up_220ms_ease-out]">
      {h.peek && (
        // กดกล่องข้อความก็เข้าแชตได้ · screen reader ใช้ปุ่มวงกลม (ชื่อปุ่มมีข้อความครบแล้ว)
        <Link
          href={href}
          onClick={onLeave}
          tabIndex={-1}
          aria-hidden="true"
          className="pointer-events-auto flex max-w-[min(250px,62vw)] flex-col rounded-[18px] rounded-br-md border border-white/95 bg-white/95 px-3.5 py-2.5 shadow-[0_12px_30px_rgba(70,50,140,0.22)] backdrop-blur-md motion-safe:animate-[sheet-up_220ms_ease-out]"
        >
          <span className="flex items-center gap-1.5 text-[13px] font-semibold">
            <span className="truncate">{h.buyerName}</span>
            {h.needsOwner && (
              <span className="shrink-0 rounded-full bg-warn-bg px-1.5 py-px text-[10.5px] font-semibold text-warn-ink">
                รอคุณตัดสิน
              </span>
            )}
          </span>
          <span className="line-clamp-2 text-[13px] text-ink-2">{h.preview}</span>
        </Link>
      )}
      <span className="pointer-events-auto relative">
        <Link
          href={href}
          onClick={onLeave}
          aria-label={label}
          className={cn(
            "block rounded-full shadow-[0_10px_26px_rgba(70,50,140,0.3)] ring-[3px] transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent motion-reduce:transition-none",
            h.needsOwner ? "ring-warn" : "ring-white",
          )}
        >
          <ChatAvatar chatId={h.chatId} name={h.buyerName} className="size-14 text-base" />
        </Link>
        {h.unread > 0 ? (
          <span
            aria-hidden="true"
            className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#E5484D] px-1 text-[11px] font-semibold text-white ring-2 ring-white"
          >
            {h.unread}
          </span>
        ) : (
          h.needsOwner && (
            <span
              aria-hidden="true"
              className="absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-full bg-warn text-[11px] font-bold text-white ring-2 ring-white"
            >
              !
            </span>
          )
        )}
        {/* ปิดหัวแชต (ลูกค้าทักใหม่ก็เด้งกลับมา) · คอม: โผล่ตอนชี้/โฟกัส · มือถือ: โชว์ตลอด */}
        <button
          type="button"
          onClick={onLeave}
          aria-label={`ซ่อนหัวแชต ${h.buyerName}`}
          className="absolute -top-1.5 -left-1.5 grid size-6 place-items-center rounded-full bg-white text-muted shadow-[0_2px_6px_rgba(0,0,0,0.18)] hover:text-ink focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-accent md:opacity-0 md:group-hover:opacity-100"
        >
          <X aria-hidden="true" size={13} />
        </button>
      </span>
    </div>
  );
}
