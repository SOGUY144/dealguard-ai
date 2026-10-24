"use client";

// ลูกค้าปิดดีลแล้ว → เด้งบนจอเถ้าแก่ทุกหน้า (อยู่ใน app/owner/layout.tsx) · กดยืนยันออเดอร์ได้ทันที หรือไปดูแชต
// ฟัง Realtime ของตาราง orders แล้วถามรายการรอยืนยันจาก server — ตัวเลขจำนวนใช้เป็น badge ในเมนูด้วย
import { BadgeCheck, Check, LoaderCircle, MessageCircle, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useLiveUpdates, type ConnectLive } from "@/components/live/use-live-updates";
import { buttonClass } from "@/components/ui/button";
import { formatBaht, formatCredit, formatQty } from "@/lib/format";
import type { PendingOrder } from "@/lib/owner/summary";
import { connectOwnerOrders } from "@/lib/supabase/live";
import type { ConfirmOrder } from "./order-actions";

/** จำนวนออเดอร์รอยืนยัน (badge ในเมนู) — นอก provider = 0 */
export const PendingCountContext = createContext(0);

/** การแจ้งเตือนที่ซ้อนกันได้มากสุด (ใหม่สุดอยู่บน) */
const MAX_ALERTS = 3;
/** ยืนยันแล้วโชว์ "ยืนยันแล้ว" ค้างไว้ครู่หนึ่งก่อนหาย */
const DONE_MS = 4_000;

type Alert = { order: PendingOrder; state: "new" | "busy" | "done"; error?: string };

type Props = {
  children: ReactNode;
  /** null = อ่านไม่ได้ตอนนี้ (ข้ามรอบนี้ ไม่ใช่ "ไม่มีออเดอร์") */
  load: () => Promise<PendingOrder[] | null>;
  confirm: ConfirmOrder;
  connect?: ConnectLive;
};

export function OrderAlertsProvider({ children, load, confirm, connect = connectOwnerOrders }: Props) {
  const router = useRouter();
  const [count, setCount] = useState(0);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  // ออเดอร์ที่เคยเห็นแล้ว · null = ยังไม่เคยดึง (รอบแรกจำไว้เฉยๆ ไม่เด้งของที่ค้างอยู่ก่อนเปิดหน้า)
  const seen = useRef<Set<string> | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const apply = useCallback((list: PendingOrder[] | null) => {
    if (!list) return;
    setCount(list.length);
    const ids = new Set(list.map((o) => o.id));
    if (!seen.current) {
      seen.current = ids;
      return;
    }
    const known = seen.current;
    const fresh = list.filter((o) => !known.has(o.id));
    for (const o of fresh) known.add(o.id);
    setAlerts((current) => [
      ...fresh.map((order): Alert => ({ order, state: "new" })),
      // ยืนยันจากที่อื่นแล้ว (อีกแท็บ / หน้าออเดอร์) → เอาออก · ที่กำลังกดอยู่หรือเพิ่งยืนยันเก็บไว้
      ...current.filter((a) => a.state !== "new" || ids.has(a.order.id)),
    ].slice(0, MAX_ALERTS));
  }, []);

  // ดึงทันทีตอนเปิดหน้า (badge ในเมนู) ไม่ต้องรอ Realtime ต่อติด — ต่อไม่ติดจะได้รอบแรกช้าไปเกือบ 20 วินาที
  useEffect(() => {
    let alive = true;
    load().then(
      (list) => alive && apply(list),
      () => {},
    );
    return () => {
      alive = false;
    };
  }, [load, apply]);
  useLiveUpdates(connect, () => void load().then(apply, () => {}));
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const update = (id: string, patch: Partial<Alert>) =>
    setAlerts((current) => current.map((a) => (a.order.id === id ? { ...a, ...patch } : a)));
  const dismiss = (id: string) => setAlerts((current) => current.filter((a) => a.order.id !== id));

  async function onConfirm(id: string) {
    update(id, { state: "busy", error: undefined });
    try {
      const result = await confirm(id);
      if (!result.ok) return update(id, { state: "new", error: result.error });
      update(id, { state: "done" });
      setCount((c) => Math.max(0, c - 1));
      router.refresh();
      timers.current.push(setTimeout(() => dismiss(id), DONE_MS));
    } catch {
      update(id, { state: "new", error: "บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง" });
    }
  }

  return (
    <PendingCountContext value={count}>
      {children}
      {/* อยู่ใน DOM ตลอด screen reader จึงอ่านการแจ้งเตือนที่เพิ่มเข้ามา · บนสุดของจอ ไม่บังช่องพิมพ์ในหน้าแชต */}
      <div
        role="region"
        aria-label="การแจ้งเตือนออเดอร์"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-3 top-3 z-40 flex flex-col gap-2 md:inset-x-auto md:top-6 md:right-6 md:w-[380px]"
      >
        {alerts.map((a) => (
          <AlertCard key={a.order.id} alert={a} onConfirm={() => void onConfirm(a.order.id)} onClose={() => dismiss(a.order.id)} />
        ))}
      </div>
    </PendingCountContext>
  );
}

function AlertCard({ alert, onConfirm, onClose }: { alert: Alert; onConfirm: () => void; onClose: () => void }) {
  const { order: o, state, error } = alert;
  const gift = o.offer.bundle ? ` + แถม ${formatQty(o.offer.bundle.qty)}` : "";
  const terms = `${formatBaht(o.offer.pricePerUnit)} × ${formatQty(o.offer.qty)}${gift} = ${formatBaht(o.offer.total)} · ${formatCredit(o.offer.creditDays)}`;
  return (
    <article
      aria-label={`ลูกค้าปิดดีลแล้ว · ${o.buyerName}`}
      className="pointer-events-auto flex flex-col gap-2.5 rounded-[20px] border border-white/95 bg-white/95 px-4 py-3 shadow-[0_18px_40px_rgba(70,50,140,0.22)] backdrop-blur-md motion-safe:animate-[sheet-up_220ms_ease-out]"
    >
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-full bg-accent-tint text-accent-ink">
          <BadgeCheck size={18} />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-sm font-semibold">ลูกค้าปิดดีลแล้ว</span>
          <span className="text-[13px]">{`${o.buyerName} · ${o.productName}`}</span>
          <span className="text-[13px] text-ink-2">{terms}</span>
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label={`ปิดการแจ้งเตือน · ${o.buyerName}`}
          className={buttonClass("ghost", "-mt-1 -mr-2 size-10 min-h-0 shrink-0 p-0 text-muted")}
        >
          <X aria-hidden="true" size={17} />
        </button>
      </div>
      {state === "done" ? (
        <p className="flex items-center gap-1.5 rounded-full bg-ok-bg px-3 py-2 text-[13px] font-semibold text-ok-ink">
          <Check aria-hidden="true" size={15} />
          ยืนยันแล้ว · ลูกค้าเห็น QR แล้ว
        </p>
      ) : (
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <button
            type="button"
            onClick={onConfirm}
            disabled={state === "busy"}
            aria-label={`ยืนยันออเดอร์ · ${o.buyerName}`}
            className={buttonClass("primary", "h-10 min-h-0 text-[13px] font-semibold")}
          >
            {state === "busy" ? (
              <LoaderCircle aria-hidden="true" size={15} className="motion-safe:animate-spin" />
            ) : (
              <BadgeCheck aria-hidden="true" size={15} />
            )}
            ยืนยันออเดอร์
          </button>
          <Link href={`/owner/chats/${o.chatId}`} className={buttonClass("secondary", "h-10 min-h-0 px-3.5 text-[13px] font-medium")}>
            <MessageCircle aria-hidden="true" size={15} />
            ดูแชต<span className="sr-only">ของ{o.buyerName}</span>
          </Link>
        </div>
      )}
      {error && (
        <p role="alert" className="text-xs text-warn-ink">
          {error}
        </p>
      )}
    </article>
  );
}

/** badge จำนวนออเดอร์รอยืนยันในเมนู — sidebar = ป้ายข้างชื่อ · bottom = จุดบนไอคอน · sr = ข้อความให้ screen reader (มือถือ) */
export function PendingOrdersBadge({ variant }: { variant: "sidebar" | "bottom" | "sr" }) {
  const count = useContext(PendingCountContext);
  if (count <= 0) return null;
  if (variant === "sr") return <span className="sr-only"> {count} ออเดอร์รอยืนยัน</span>;
  if (variant === "bottom") {
    return (
      <span className="absolute -top-2 -right-3 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-warn px-1 text-[11px] font-semibold text-white">
        {count}
      </span>
    );
  }
  return (
    <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-warn px-[7px] text-xs font-semibold text-white">
      <span className="sr-only"> มี </span>
      {count}
      <span className="sr-only"> ออเดอร์รอยืนยัน</span>
    </span>
  );
}
