"use client";

import { Check, ClipboardCopy, LoaderCircle, MessageSquareText, Sparkles } from "lucide-react";
import { useId, useState, type FormEvent } from "react";
import { buttonClass } from "@/components/ui/button";
import type { Offer } from "@/lib/chat/types";
import { formatBaht } from "@/lib/format";

/** สิ่งที่ /api/owner/assist ตอบ (ตรงกับ AssistResult ฝั่ง server) */
export type AssistView = {
  replyText: string;
  offers: { offer: Offer; profit: number }[];
  decision: string[] | null;
  missing: "quantity" | "product" | null;
  productName: string | null;
};

export type AssistTransport = (input: { text: string; buyerName?: string }) => Promise<AssistView>;

async function callAssist(input: { text: string; buyerName?: string }): Promise<AssistView> {
  const res = await fetch("/api/owner/assist", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`assist ${res.status}`);
  return (await res.json()) as AssistView;
}

const EXAMPLE = "ขอ 125 ได้ไหม 1000 ชิ้น";

/**
 * โหมดผู้ช่วยเถ้าแก่ — ลูกค้าคุยใน LINE ส่วนตัว (บอทเข้าไม่ได้): วางข้อความ → ได้ข้อเสนอที่ไม่ขาดทุน + ข้อความพร้อมส่ง
 * กำไรแต่ละข้อเห็นเฉพาะหน้านี้ ไม่อยู่ในข้อความที่คัดลอก
 */
export function AssistPanel({ assist = callAssist }: { assist?: AssistTransport }) {
  const [text, setText] = useState("");
  const [buyerName, setBuyerName] = useState("");
  const [result, setResult] = useState<AssistView | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const ids = { text: useId(), name: useId() };

  async function submit(e: FormEvent) {
    e.preventDefault();
    const value = text.trim();
    if (!value || busy) return;
    setBusy(true);
    setError(null);
    setCopied(false);
    try {
      setResult(await assist({ text: value, ...(buyerName.trim() && { buyerName: buyerName.trim() }) }));
    } catch {
      setError("คิดข้อเสนอไม่สำเร็จ ลองอีกครั้ง");
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!result?.replyText) return;
    try {
      await navigator.clipboard.writeText(result.replyText);
      setCopied(true);
    } catch {
      setError("คัดลอกไม่ได้ ลองเลือกข้อความแล้วคัดลอกเอง");
    }
  }

  const field = "w-full rounded-xl border border-line bg-white px-3 text-base outline-none focus:border-accent md:text-sm";

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-1 px-1">
        <h1 className="text-[22px] font-semibold md:text-[26px]">ผู้ช่วยตอบ LINE</h1>
        <p className="text-sm leading-[1.6] text-muted">
          ลูกค้าคุยใน LINE ส่วนตัว? วางข้อความลูกค้าที่นี่ ระบบคิดข้อเสนอที่ร้านไม่ขาดทุน แล้วเขียนคำตอบให้คัดลอกไปส่งเอง
        </p>
      </header>

      <form onSubmit={submit} className="glass flex flex-col gap-3 rounded-[24px] p-4 md:p-5">
        <div className="flex flex-col gap-1">
          <label htmlFor={ids.text} className="text-xs text-muted">
            ข้อความลูกค้า (วางทั้งบทสนทนาได้ หลายบรรทัด)
          </label>
          <textarea
            id={ids.text}
            rows={4}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={EXAMPLE}
            className={`${field} min-h-[104px] py-2.5 leading-[1.6]`}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={ids.name} className="text-xs text-muted">
            ชื่อลูกค้า (ไม่ใส่ก็ได้)
          </label>
          <input
            id={ids.name}
            type="text"
            value={buyerName}
            onChange={(e) => setBuyerName(e.target.value)}
            placeholder="เช่น นก"
            autoComplete="off"
            className={`${field} h-10`}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="submit" disabled={busy || !text.trim()} className={buttonClass("primary", "h-11 min-h-0 px-5 text-sm")}>
            {busy ? (
              <LoaderCircle aria-hidden="true" size={16} className="motion-safe:animate-spin" />
            ) : (
              <Sparkles aria-hidden="true" size={16} />
            )}
            คิดข้อเสนอ
          </button>
          {!text && (
            <button type="button" onClick={() => setText(EXAMPLE)} className={buttonClass("chip", "min-h-10 text-[13px] font-medium")}>
              ลองตัวอย่าง: {EXAMPLE}
            </button>
          )}
        </div>
        {error && (
          <p role="alert" className="text-xs text-warn-ink">
            {error}
          </p>
        )}
      </form>

      {result && (
        <section aria-label="ผลจากผู้ช่วย" className="flex flex-col gap-3">
          {result.decision && (
            <div className="flex flex-col gap-1.5 rounded-[20px] bg-warn-bg px-4 py-3 text-warn-ink">
              <span className="text-sm font-semibold">เรื่องนี้ให้คุณตัดสินเอง — AI ไม่ลดเพิ่มเอง</span>
              <ol className="flex list-decimal flex-col gap-0.5 pl-[18px] text-[13px] leading-[1.55]">
                {result.decision.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ol>
            </div>
          )}

          {result.offers.length > 0 && (
            <ul aria-label="ข้อเสนอ" className="flex flex-col gap-2">
              {result.offers.map(({ offer, profit }) => (
                <li
                  key={offer.id}
                  className="grid grid-cols-[34px_1fr_auto] items-center gap-x-3 rounded-[18px] border border-line-soft bg-white/85 px-3.5 py-2.5"
                >
                  <span className="row-span-2 grid size-[34px] place-items-center rounded-full bg-accent-tint font-bold text-accent-ink">
                    {offer.id}
                  </span>
                  <span className="text-sm font-semibold">
                    {offer.label} · {formatBaht(offer.pricePerUnit)}/ชิ้น
                  </span>
                  <span className="text-right text-sm font-semibold text-ok-ink">กำไร {formatBaht(profit)}</span>
                  <span className="text-xs text-muted">{offer.conditionText}</span>
                  <span className="text-right text-xs text-muted">รวม {formatBaht(offer.total)}</span>
                </li>
              ))}
            </ul>
          )}

          {result.replyText && (
            <div className="glass flex flex-col gap-2.5 rounded-[22px] p-4">
              <span className="flex items-center gap-1.5 text-xs font-semibold text-accent-ink">
                <MessageSquareText aria-hidden="true" size={14} />
                ข้อความพร้อมส่งใน LINE {result.missing === "quantity" && "· ลูกค้ายังไม่บอกจำนวน"}
              </span>
              <p className="whitespace-pre-line rounded-[14px] bg-white/90 px-3.5 py-3 text-sm leading-[1.7]">{result.replyText}</p>
              <button type="button" onClick={() => void copy()} className={buttonClass("primary", "h-11 min-h-0 text-sm")}>
                {copied ? <Check aria-hidden="true" size={16} /> : <ClipboardCopy aria-hidden="true" size={16} />}
                {copied ? "คัดลอกแล้ว — ไปวางใน LINE ได้เลย" : "คัดลอกข้อความ"}
              </button>
              <span className="text-xs text-muted">ข้อความไม่มีต้นทุนหรือกำไร · ตัวเลขทุกตัวมาจากระบบคำนวณของร้าน</span>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
