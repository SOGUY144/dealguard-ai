"use client";

import { ArrowLeft, ArrowRight, BadgeCheck, CircleCheck, LoaderCircle, Mic, Sparkles, Square, User } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { type ConnectLive, useLiveUpdates } from "@/components/live/use-live-updates";
import { buttonClass } from "@/components/ui/button";
import { OWNER_CREDIT_CHOICES } from "@/lib/chat/owner-approval";
import type { ChatMessage } from "@/lib/chat/types";
import { cn } from "@/lib/cn";
import { formatBaht, formatClock, formatCredit, formatDayLabel, formatQty } from "@/lib/format";
import {
  approvalDefaults,
  approvalPreview,
  approvalSuggestions,
  quickReplies,
  type ApprovalProduct,
  type ApprovalSuggestion,
  type OwnerChatView,
} from "@/lib/owner/chat-view";
import { escalationLabel, ownerInitials } from "@/lib/owner/summary";
import { browserVoice, type LiveVoice } from "@/components/chat/use-chat-session";
import type { Recorder } from "@/components/chat/voice-input";
import { LiveStatusNote } from "./owner-live";

export type OwnerChatAction =
  | { type: "reply"; text: string }
  | { type: "resolve" }
  | { type: "handback" }
  /** เถ้าแก่ตัดสินแทน AI — ลูกค้าได้การ์ดข้อเสนอที่กดยืนยันเป็นออเดอร์ได้ */
  | { type: "approve_price"; sku: string; pricePerUnit: number; qty: number; creditDays: number };

export type OwnerChatTransport = {
  act: (action: OwnerChatAction) => Promise<OwnerChatView>;
  load: () => Promise<OwnerChatView>;
};

type Props = {
  initial: OwnerChatView;
  ownerName: string;
  transport: OwnerChatTransport;
  /** Realtime ของแชตนี้ (test ใส่ null) */
  connect: ConnectLive | null;
  /** มีคีย์แปลงเสียง (OPENAI_TRANSCRIBE_MODEL) — ไม่มี ปุ่มไมค์กดไม่ได้ */
  voiceInput?: boolean;
  /** ไม่ใส่ = ไมค์ของ browser + /api/transcribe */
  voice?: LiveVoice;
  /** สินค้าที่อนุมัติราคาได้ (มีต้นทุน — หน้าเถ้าแก่เท่านั้น) · ไม่ใส่ = ไม่มีปุ่มอนุมัติราคา */
  approvalProducts?: ApprovalProduct[];
};

/** อัดได้นานสุด แล้วหยุดเอง (เหมือนฝั่งลูกค้า) */
const MAX_RECORD_MS = 30_000;

/** หน้าแชตเถ้าแก่ (Owner-Chat): ลูกค้าซ้าย · AI/เถ้าแก่ขวา · สรุปจาก AI · ตอบในชื่อเถ้าแก่ · ให้ AI ตอบต่อ */
export function OwnerChatScreen({
  initial,
  ownerName,
  transport,
  connect,
  voiceInput = false,
  voice = browserVoice,
  approvalProducts = [],
}: Props) {
  const [approving, setApproving] = useState(false);
  const [view, setView] = useState(initial);
  const [pending, setPending] = useState<OwnerChatAction["type"] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState("");
  // พูดแทนพิมพ์: ข้อความที่แปลงได้ไปอยู่ในช่องตอบ ให้เถ้าแก่ตรวจก่อนกดส่งเอง
  const [dictation, setDictation] = useState<"idle" | "recording" | "transcribing">("idle");
  const [voiceNotice, setVoiceNotice] = useState<string | null>(null);
  const recorder = useRef<Recorder | null>(null);
  const autoStop = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  /** กำลังรอเบราว์เซอร์ให้สิทธิ์ไมค์ — กดซ้ำไม่สร้างตัวอัดที่สอง */
  const startingMic = useRef(false);
  const onScreen = useRef(false);
  // ออกจากหน้า (Next 16 ซ่อนหน้าไว้ด้วย <Activity> แทนการปิด) → ปิดไมค์ทันที ทิ้งเสียงที่อัดค้าง
  useLayoutEffect(() => {
    onScreen.current = true;
    return () => {
      onScreen.current = false;
      clearTimeout(autoStop.current);
      recorder.current?.cancel();
      recorder.current = null;
      setDictation((d) => (d === "recording" ? "idle" : d));
    };
  }, []);
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  // มาจากปุ่ม "ตอบเอง" (#reply) → พร้อมพิมพ์ทันที
  useEffect(() => {
    if (window.location.hash === "#reply") inputRef.current?.focus();
  }, []);

  const reload = useCallback(() => {
    transport.load().then(setView, () => {});
  }, [transport]);
  const live = useLiveUpdates(connect, reload);

  async function act(action: OwnerChatAction): Promise<boolean> {
    if (pending) return false;
    setPending(action.type);
    setError(null);
    try {
      setView(await transport.act(action));
      return true;
    } catch {
      setError("ส่งไม่สำเร็จ ลองอีกครั้ง");
      return false;
    } finally {
      setPending(null);
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const value = text.trim();
    if (!value) return;
    setText("");
    if (!(await act({ type: "reply", text: value }))) setText((current) => current || value);
  }

  const esc = view.escalation;
  const subtitle = esc ? `ลูกค้า · ${escalationLabel(esc.kind)}` : "ลูกค้า";
  const chips = useMemo(() => quickReplies(esc?.kind ?? null), [esc?.kind]);
  const humanMode = view.mode === "human";

  async function stopDictation() {
    clearTimeout(autoStop.current);
    const rec = recorder.current;
    recorder.current = null;
    if (!rec) return;
    setDictation("transcribing");
    try {
      const heard = (await voice.transcribe(await rec.stop())).trim();
      if (!heard) {
        setVoiceNotice("ไม่ได้ยินเสียงพูด ลองพูดอีกครั้ง หรือพิมพ์แทน");
        return;
      }
      setText((current) => (current.trim() ? `${current.trim()} ${heard}` : heard));
      inputRef.current?.focus();
    } catch {
      setVoiceNotice("แปลงเสียงไม่สำเร็จ ลองอีกครั้ง หรือพิมพ์แทน");
    } finally {
      setDictation("idle");
    }
  }

  async function onMic() {
    if (dictation === "transcribing" || startingMic.current) return;
    if (dictation === "recording") return void stopDictation();
    setVoiceNotice(null);
    const rec = voice.recorder();
    startingMic.current = true;
    try {
      await rec.start();
    } catch {
      setVoiceNotice("ใช้ไมค์ไม่ได้ อนุญาตไมค์ในเบราว์เซอร์ หรือพิมพ์แทน");
      return;
    } finally {
      startingMic.current = false;
    }
    if (!onScreen.current) return rec.cancel();
    recorder.current = rec;
    setDictation("recording");
    autoStop.current = setTimeout(() => void stopDictation(), MAX_RECORD_MS);
  }

  return (
    <div className="mx-auto flex h-dvh w-full max-w-[760px] flex-col">
      <header className="glass-pill mx-3 mt-3 flex shrink-0 items-center gap-2.5 py-2 pr-3 pl-2">
        <Link href="/owner" aria-label="กลับไปหน้าภาพรวม" className={buttonClass("white", "size-11 shrink-0 p-0")}>
          <ArrowLeft aria-hidden="true" size={19} />
        </Link>
        <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#EEF1FB] text-[#4A4C63]">
          <User size={19} />
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <h1 className="truncate text-[15px] leading-[1.4] font-semibold">{view.buyerName}</h1>
          <span className="text-xs text-muted">{subtitle}</span>
        </div>
      </header>

      {esc && (
        <section
          aria-label="สรุปจาก AI"
          className="mx-3 mt-2.5 flex shrink-0 flex-col gap-1.5 rounded-[20px] border border-white/95 bg-white/72 px-3.5 py-3 shadow-[0_8px_22px_rgba(110,90,170,0.08)]"
        >
          <span className="flex items-center gap-1.5 text-xs font-semibold text-accent-ink">
            <Sparkles aria-hidden="true" size={14} />
            สรุปจาก AI
          </span>
          <ol className="flex list-decimal flex-col gap-0.5 pl-[18px] text-[13px] leading-[1.55]">
            {esc.brief.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ol>
          <div className="flex items-center justify-between gap-2 pt-1">
            {esc.status === "open" ? (
              <>
                <span className="text-xs font-semibold text-warn-ink">รอตัดสิน</span>
                <button
                  type="button"
                  onClick={() => void act({ type: "resolve" })}
                  disabled={pending !== null}
                  className={buttonClass("secondary", "h-10 min-h-0 px-3.5 text-[13px] font-medium")}
                >
                  <CircleCheck aria-hidden="true" size={15} />
                  ปิดเรื่องนี้
                </button>
              </>
            ) : (
              <span className="flex items-center gap-1.5 text-xs text-ok-ink">
                <CircleCheck aria-hidden="true" size={14} />
                ปิดเรื่องแล้ว
              </span>
            )}
          </div>
        </section>
      )}

      {/* column-reverse: เริ่มชิดล่างและค้างอยู่ที่ข้อความล่าสุด */}
      <div className="flex min-h-0 flex-1 flex-col-reverse overflow-y-auto overscroll-contain">
        <div role="log" aria-live="polite" aria-label="ข้อความในแชต" className="flex flex-col gap-3 px-3.5 pt-3.5 pb-2">
          {view.messages[0] && (
            <span className="self-center rounded-full bg-white/90 px-3 py-1 text-xs text-muted">
              {formatDayLabel(view.messages[0].at, new Date())} · {formatClock(view.messages[0].at)}
            </span>
          )}
          {view.messages.map((m) => (
            <OwnerViewMessage key={m.id} message={m} buyerName={view.buyerName} ownerName={ownerName} />
          ))}
          {humanMode && (
            <span className="inline-flex items-center gap-1.5 self-center rounded-full border border-[#EFEAF8] bg-white/85 px-3 py-[5px] text-xs text-[#4A4C63]">
              <span aria-hidden="true" className="size-[7px] rounded-full bg-accent" />
              AI หยุดตอบแชตนี้ · คุณตอบลูกค้าเอง
            </span>
          )}
        </div>
      </div>

      <div className="flex shrink-0 flex-col gap-2 px-3 pt-1.5 pb-4">
        <LiveStatusNote status={live} />
        {error && (
          <p role="alert" className="px-1 text-xs text-warn-ink">
            {error}
          </p>
        )}
        {approving && approvalProducts.length > 0 && (
          <ApprovePanel
            products={approvalProducts}
            messages={view.messages}
            buyerName={view.buyerName}
            busy={pending !== null}
            onCancel={() => setApproving(false)}
            onApprove={async (terms) => {
              if (await act({ type: "approve_price", ...terms })) setApproving(false);
            }}
          />
        )}
        <div className="flex gap-2 overflow-x-auto">
          {approvalProducts.length > 0 && !approving && (
            <button
              type="button"
              disabled={pending !== null}
              onClick={() => setApproving(true)}
              className={buttonClass("primary", "min-h-10 shrink-0 px-3.5 text-[13px] font-semibold")}
            >
              <BadgeCheck aria-hidden="true" size={15} />
              อนุมัติราคา
            </button>
          )}
          {chips.map((chip) => (
            <button
              key={chip}
              type="button"
              disabled={pending !== null}
              onClick={() => void act({ type: "reply", text: chip })}
              className={buttonClass("chip", "min-h-10 shrink-0 text-[13px] font-medium")}
            >
              {chip}
            </button>
          ))}
        </div>
        <form
          id="reply"
          onSubmit={submit}
          className="flex flex-col gap-1 rounded-[22px] border-[1.5px] border-accent-border bg-white py-2 pr-2 pl-3.5 shadow-soft"
        >
          <span className="text-xs font-semibold text-accent-ink">ตอบในชื่อ{ownerName}</span>
          <label htmlFor={inputId} className="sr-only">
            พิมพ์ตอบ{view.buyerName}
          </label>
          <input
            ref={inputRef}
            id={inputId}
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={`พิมพ์ตอบ${view.buyerName}...`}
            autoComplete="off"
            enterKeyHint="send"
            className="h-[34px] w-full bg-transparent text-base outline-none placeholder:text-muted md:text-sm"
          />
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => void act({ type: "handback" })}
              disabled={!humanMode || pending !== null}
              className={buttonClass("secondary", "h-10 min-h-0 px-3 text-[13px] font-medium")}
            >
              {pending === "handback" ? (
                <LoaderCircle aria-hidden="true" size={15} className="motion-safe:animate-spin" />
              ) : (
                <Sparkles aria-hidden="true" size={15} />
              )}
              ให้ AI ตอบต่อ
            </button>
            {/* พูดแทนพิมพ์ — แปลงเป็นข้อความใส่ช่องตอบ (ลูกค้าเห็นเป็นข้อความ ไม่ใช่เสียงเถ้าแก่) */}
            <button
              type="button"
              onClick={() => void onMic()}
              disabled={!voiceInput || dictation === "transcribing"}
              aria-pressed={dictation === "recording"}
              aria-label={dictation === "recording" ? "หยุดอัดเสียง" : voiceInput ? "พูดแทนพิมพ์" : "พูดแทนพิมพ์ (ยังไม่ได้ตั้งค่าแปลงเสียง)"}
              className={buttonClass("ghost", cn("size-11 p-0", dictation === "recording" && "bg-warn-bg text-warn-ink"))}
            >
              {dictation === "transcribing" ? (
                <LoaderCircle aria-hidden="true" size={18} className="motion-safe:animate-spin" />
              ) : dictation === "recording" ? (
                <Square aria-hidden="true" size={16} fill="currentColor" />
              ) : (
                <Mic aria-hidden="true" size={19} />
              )}
            </button>
            <span className="flex-1" />
            <button
              type="submit"
              aria-label="ส่งข้อความ"
              disabled={pending !== null}
              className={buttonClass("primary", "size-11 min-h-0 p-0")}
            >
              {pending === "reply" ? (
                <LoaderCircle aria-hidden="true" size={17} className="motion-safe:animate-spin" />
              ) : (
                <ArrowRight aria-hidden="true" size={17} strokeWidth={2.2} />
              )}
            </button>
          </div>
        </form>
        <p aria-live="polite" className="px-2 text-xs text-muted empty:hidden">
          {dictation === "recording" ? "กำลังฟัง… กดปุ่มอีกครั้งเมื่อพูดจบ" : voiceNotice}
        </p>
      </div>
    </div>
  );
}

/** ข้อความหนึ่งรายการในมุมของเถ้าแก่ — ลูกค้าซ้าย (ไอคอนคน) · ร้านขวา (AI = ประกาย, เถ้าแก่ = อักษรย่อ) */
function OwnerViewMessage({ message: m, buyerName, ownerName }: { message: ChatMessage; buyerName: string; ownerName: string }) {
  const time = formatClock(m.at);
  switch (m.type) {
    case "buyer_text":
    case "product_card":
      return (
        <div className="flex max-w-[86%] items-end gap-2">
          <span aria-hidden="true" className="flex size-[30px] shrink-0 items-center justify-center rounded-full bg-[#EEF1FB] text-[#4A4C63]">
            <User size={15} />
          </span>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted">
              {buyerName} · {time}
              {m.type === "buyer_text" && m.inputMode === "voice" ? " · พูด" : ""}
            </span>
            <div className="rounded-[18px_18px_18px_6px] border border-line-soft bg-white px-3 py-2.5 text-sm leading-[1.55]">
              {m.type === "buyer_text" ? m.text : `เลือกสินค้า ${m.name} · ${formatBaht(m.listPrice)}/ชิ้น`}
            </div>
          </div>
        </div>
      );
    case "ai_text":
    case "ai_voice":
    case "offers":
    case "order_summary":
      return (
        <StoreSide who="ai" label={`${time} · ผู้ช่วย AI`}>
          {m.type === "ai_text"
            ? m.text
            : m.type === "ai_voice"
              ? m.transcript
              : m.type === "offers"
                ? <OffersSummary message={m} />
                : `ออเดอร์ ${m.offer.id} · ${m.offer.label} · ${formatBaht(m.offer.pricePerUnit)} × ${formatQty(m.offer.qty)} = ${formatBaht(m.offer.total)}`}
        </StoreSide>
      );
    case "owner_text":
      return (
        <StoreSide who="owner" label={`${time} · ${ownerName} (คุณ)`} initials={ownerInitials(ownerName)}>
          {m.text}
        </StoreSide>
      );
    case "handoff":
      return (
        <span className="inline-flex items-center gap-1.5 self-center rounded-full border border-[#EFEAF8] bg-white/85 px-3 py-[5px] text-xs text-[#4A4C63]">
          <span aria-hidden="true" className="size-[7px] rounded-full bg-accent" />
          AI ส่งเรื่องนี้ให้คุณ · {m.subject}
        </span>
      );
    case "system":
      if (m.kind === "voice_unavailable") return null;
      return (
        <span className="self-center rounded-full border border-[#EFEAF8] bg-white/85 px-3 py-[5px] text-xs text-[#4A4C63]">
          {m.kind === "ai_resumed" ? "คุณให้ AI ตอบต่อแล้ว" : "ราคาล็อกโดยระบบของร้าน"}
        </span>
      );
  }
}

function StoreSide({
  who,
  label,
  initials,
  children,
}: {
  who: "ai" | "owner";
  label: string;
  initials?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex max-w-[86%] items-end gap-2 self-end">
      <div className="flex flex-col items-end gap-1">
        <span className="text-xs text-muted">{label}</span>
        <div
          className={cn(
            "rounded-[18px_18px_6px_18px] px-3 py-2.5 text-sm leading-[1.55]",
            who === "ai" ? "bg-accent-tint" : "border border-accent-border bg-white",
          )}
        >
          {children}
        </div>
      </div>
      <span
        aria-hidden="true"
        className="flex size-[30px] shrink-0 items-center justify-center rounded-full bg-accent-tint text-[11px] font-semibold text-accent"
      >
        {who === "ai" ? <Sparkles size={15} /> : initials}
      </span>
    </div>
  );
}

function OffersSummary({ message }: { message: Extract<ChatMessage, { type: "offers" }> }) {
  return (
    <span className="flex flex-col gap-0.5">
      <span>เสนอ {message.offers.length} ทาง{message.confirmed && message.selectedId ? ` · ลูกค้ายืนยันข้อ ${message.selectedId}` : ""}</span>
      {message.offers.map((o) => (
        <span key={o.id} className="text-[13px] text-ink-2">
          {o.id} {o.label} · {formatBaht(o.pricePerUnit)} × {formatQty(o.qty)} = {formatBaht(o.total)}
        </span>
      ))}
    </span>
  );
}

type ApprovalTerms = { sku: string; pricePerUnit: number; qty: number; creditDays: number };

/**
 * เถ้าแก่ตัดสินแทน AI: ใส่ราคา/จำนวน/วันจ่าย เห็นกำไรก่อนกด → ลูกค้าได้การ์ดที่กดยืนยันเป็นออเดอร์ได้
 * ตัวเลขในนี้ใช้ให้เถ้าแก่ดูเท่านั้น — server คิดยอดใหม่เองตอนบันทึก
 */
function ApprovePanel({
  products,
  messages,
  buyerName,
  busy,
  onCancel,
  onApprove,
}: {
  products: ApprovalProduct[];
  messages: ChatMessage[];
  buyerName: string;
  busy: boolean;
  onCancel: () => void;
  onApprove: (terms: ApprovalTerms) => void | Promise<void>;
}) {
  const [defaults] = useState(() => approvalDefaults(messages, products));
  const [sku, setSku] = useState(defaults.sku);
  const [price, setPrice] = useState("");
  const [qty, setQty] = useState(defaults.qty ? String(defaults.qty) : "");
  const [creditDays, setCreditDays] = useState<number>(OWNER_CREDIT_CHOICES[0]);
  const ids = { product: useId(), price: useId(), qty: useId(), credit: useId(), suggested: useId() };

  const product = products.find((p) => p.sku === sku) ?? products[0];
  // ช่องราคาว่างไว้จนเถ้าแก่กด chip หรือพิมพ์เอง — ราคาที่ลูกค้าขออาจต่ำกว่าราคาพื้น
  const suggestions = useMemo(() => (product ? approvalSuggestions(messages, products, product.sku) : []), [messages, products, product]);
  // วันจ่ายจากข้อเสนอเดิม (เช่น 45 วัน) ที่ไม่มีในตัวเลือกของเถ้าแก่ → เพิ่มเป็นตัวเลือก
  const creditChoices = [...new Set<number>([...OWNER_CREDIT_CHOICES, ...suggestions.flatMap((s) => s.creditDays ?? []), creditDays])].sort(
    (a, b) => a - b,
  );
  const pick = (s: ApprovalSuggestion) => {
    setPrice(String(s.pricePerUnit));
    if (s.qty !== undefined) setQty(String(s.qty));
    if (s.creditDays !== undefined) setCreditDays(s.creditDays);
  };
  const picked = (s: ApprovalSuggestion) =>
    price.trim() !== "" &&
    Number(price) === s.pricePerUnit &&
    (s.qty === undefined || Number(qty) === s.qty) &&
    (s.creditDays === undefined || creditDays === s.creditDays);
  const priceN = Number(price);
  const qtyN = Number(qty);
  const valid = !!product && price.trim() !== "" && priceN > 0 && Number.isInteger(qtyN) && qtyN > 0;
  const preview = valid ? approvalPreview(product, priceN, qtyN) : null;
  const field = "h-10 w-full rounded-xl border border-line bg-white px-3 text-base outline-none focus:border-accent md:text-sm";

  return (
    <section
      aria-label="อนุมัติราคาให้ลูกค้า"
      className="flex flex-col gap-2.5 rounded-[20px] border border-accent-border bg-white/95 px-3.5 py-3 shadow-soft"
    >
      <span className="flex items-center gap-1.5 text-xs font-semibold text-accent-ink">
        <BadgeCheck aria-hidden="true" size={14} />
        อนุมัติราคาให้{buyerName} · AI เจรจา คุณแค่ตัดสิน
      </span>

      {products.length > 1 && (
        <div className="flex flex-col gap-1">
          <label htmlFor={ids.product} className="text-xs text-muted">
            สินค้า
          </label>
          <select id={ids.product} value={product?.sku} onChange={(e) => setSku(e.target.value)} className={field}>
            {products.map((p) => (
              <option key={p.sku} value={p.sku}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {suggestions.length > 0 && (
        <div className="flex flex-col gap-1">
          <span id={ids.suggested} className="text-xs text-muted">
            ราคาแนะนำ
          </span>
          <div role="group" aria-labelledby={ids.suggested} className="flex flex-wrap gap-1.5">
            {suggestions.map((s) => (
              <button
                key={s.label}
                type="button"
                aria-pressed={picked(s)}
                onClick={() => pick(s)}
                className={buttonClass(
                  "chip",
                  cn("min-h-10 text-[13px] font-medium", picked(s) && "border-accent bg-accent-tint2 text-accent-ink"),
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1">
          <label htmlFor={ids.price} className="text-xs text-muted">
            ราคาต่อชิ้น (บาท)
          </label>
          <input
            id={ids.price}
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder={product ? String(product.listPrice) : ""}
            className={field}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={ids.qty} className="text-xs text-muted">
            จำนวน (ชิ้น)
          </label>
          <input
            id={ids.qty}
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            className={field}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <span id={ids.credit} className="text-xs text-muted">
          ต้องจ่ายภายใน
        </span>
        <div role="group" aria-labelledby={ids.credit} className="flex flex-wrap gap-1.5">
          {creditChoices.map((days) => (
            <button
              key={days}
              type="button"
              aria-pressed={creditDays === days}
              onClick={() => setCreditDays(days)}
              className={cn(
                "h-9 rounded-full border px-3 text-[13px] font-medium",
                creditDays === days ? "border-accent bg-accent-tint2 text-accent-ink" : "border-line bg-white text-ink",
              )}
            >
              {formatCredit(days)}
            </button>
          ))}
        </div>
      </div>

      {product && (
        <p aria-live="polite" className="text-[13px] leading-[1.55]">
          {preview ? (
            <>
              <span className="font-semibold">
                ยอดรวม {formatBaht(preview.total)} · {preview.profit >= 0 ? "กำไร" : "ขาดทุน"} {formatBaht(Math.abs(preview.profit))}
              </span>
              {preview.profitPctOfCost !== null && <span className="text-muted"> ({preview.profitPctOfCost}% ของทุน)</span>}
              {preview.belowCost ? (
                <span className="block text-warn-ink">ราคานี้ต่ำกว่าทุน — ร้านขาดทุน</span>
              ) : preview.belowFloor ? (
                <span className="block text-warn-ink">ต่ำกว่าราคาพื้น {formatBaht(product.floorPrice)} ที่ตั้งไว้ — AI จะไม่เสนอเอง แต่คุณอนุมัติได้</span>
              ) : (
                <span className="block text-ok-ink">ไม่ต่ำกว่าราคาพื้น {formatBaht(product.floorPrice)}</span>
              )}
            </>
          ) : (
            <span className="text-muted">ใส่ราคาและจำนวน เพื่อดูยอดรวมและกำไรก่อนอนุมัติ</span>
          )}
        </p>
      )}

      <div className="grid grid-cols-[auto_1fr] gap-2">
        <button type="button" onClick={onCancel} className={buttonClass("secondary", "h-[42px] min-h-0 px-4 text-sm font-medium")}>
          ยกเลิก
        </button>
        <button
          type="button"
          disabled={!valid || busy}
          onClick={() => product && void onApprove({ sku: product.sku, pricePerUnit: priceN, qty: qtyN, creditDays })}
          className={buttonClass("primary", "h-[42px] min-h-0 text-sm")}
        >
          {busy ? <LoaderCircle aria-hidden="true" size={15} className="motion-safe:animate-spin" /> : null}
          อนุมัติ · ส่งให้ลูกค้ายืนยัน
        </button>
      </div>
    </section>
  );
}
