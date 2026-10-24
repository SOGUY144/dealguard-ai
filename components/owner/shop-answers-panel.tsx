"use client";

// คำตอบให้ลูกค้า (SKILL §11.3) — ไม่มีในไฟล์ดีไซน์ ทำให้เข้าชุดกับหน้าสินค้า
// ลูกค้าถาม "ส่งกี่วัน" / "มีของไหม" → ผู้ช่วยตอบด้วยข้อความนี้ตรงตัว · เรื่องจ่ายเงินใช้บัญชีร้านอยู่แล้ว ไม่ต้องกรอก
import { MessageCircleQuestion } from "lucide-react";
import { useId, useState } from "react";
import { buttonClass } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import type { FieldErrors, SaveResult } from "@/lib/owner/product-settings";
import { SHOP_ANSWER_MAX, cleanShopAnswers, validateShopAnswers, type ShopAnswers } from "@/lib/owner/shop-answers";
import { StatusLine, type Status } from "./settings-ui";

type Props = { initial: ShopAnswers; save: (answers: ShopAnswers) => Promise<SaveResult> };

const EMPTY_HINT = 'ว่างไว้ = ผู้ช่วยบอกลูกค้าให้กด "คุยกับคนจริง" ถามเถ้าแก่เอง';

export function ShopAnswersPanel({ initial, save }: Props) {
  const [draft, setDraft] = useState(initial);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const edit = (patch: Partial<ShopAnswers>) => {
    setDraft((d) => ({ ...d, ...patch }));
    setErrors({});
    setStatus({ kind: "idle" });
  };

  async function onSave() {
    const cleaned = cleanShopAnswers(draft);
    const found = validateShopAnswers(cleaned);
    if (Object.keys(found).length > 0) {
      setErrors(found);
      setStatus({ kind: "error", message: "ยังบันทึกไม่ได้ แก้ช่องที่ขึ้นสีส้มก่อน" });
      return;
    }
    setStatus({ kind: "saving" });
    try {
      const result = await save(cleaned);
      if (result.ok) {
        setDraft(cleaned);
        setStatus({ kind: "saved", message: "บันทึกแล้ว ลูกค้าถามครั้งถัดไปได้คำตอบนี้" });
        return;
      }
      const { form, ...fields } = result.errors;
      setErrors(fields);
      setStatus({ kind: "error", message: form ?? "ยังบันทึกไม่ได้ แก้ช่องที่ขึ้นสีส้มก่อน" });
    } catch {
      setStatus({ kind: "error", message: "บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง" });
    }
  }

  return (
    <section aria-labelledby="shop-answers-title" className="glass mt-4 flex flex-col gap-5 rounded-[26px] px-4 py-5 md:px-6 md:py-[22px]">
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-full bg-accent-tint text-accent">
          <MessageCircleQuestion size={19} />
        </span>
        <div className="flex flex-col gap-0.5">
          <h2 id="shop-answers-title" className="text-lg leading-[1.4] font-semibold">
            คำตอบให้ลูกค้า <span className="text-sm font-normal text-muted">(ใช้ทั้งร้าน)</span>
          </h2>
          <p className="text-sm text-muted">ลูกค้าถามเรื่องเหล่านี้ ผู้ช่วยตอบด้วยข้อความนี้ตรงตัว · เรื่องจ่ายเงินผู้ช่วยบอกบัญชีร้านให้เอง</p>
        </div>
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(280px,100%),1fr))] gap-4">
        <AnswerField
          label='การส่งของ เช่น "ส่งกี่วัน" "ค่าส่งเท่าไหร่"'
          value={draft.delivery}
          onChange={(delivery) => edit({ delivery })}
          error={errors.delivery}
        />
        <AnswerField label='สต๊อก เช่น "มีของไหม"' value={draft.stock} onChange={(stock) => edit({ stock })} error={errors.stock} />
      </div>
      <div className="flex flex-wrap items-center justify-end gap-3">
        <StatusLine status={status} className="flex-auto" />
        <button
          type="button"
          onClick={() => void onSave()}
          aria-busy={status.kind === "saving"}
          disabled={status.kind === "saving"}
          className={buttonClass("primary", "h-12 px-7 font-semibold")}
        >
          บันทึกคำตอบ
        </button>
      </div>
    </section>
  );
}

function AnswerField({ label, value, onChange, error }: { label: string; value: string; onChange: (v: string) => void; error?: string }) {
  const id = useId();
  const over = value.length > SHOP_ANSWER_MAX;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] font-medium">
        {label}
      </label>
      <textarea
        id={id}
        rows={3}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={`${id}-hint`}
        className={cn(
          "min-h-[96px] resize-y rounded-[14px] px-3.5 py-3 text-base leading-[1.55] outline-none focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent md:text-[15px]",
          error ? "border-[1.5px] border-warn bg-warn-bg" : "border border-line bg-white/85",
        )}
      />
      <span id={`${id}-hint`} className={cn("flex justify-between gap-3 text-xs", error ? "text-warn-ink" : "text-muted")}>
        <span>{error ?? (value.trim() ? "" : EMPTY_HINT)}</span>
        <span className={over ? "text-warn-ink" : undefined}>
          {value.length}/{SHOP_ANSWER_MAX}
        </span>
      </span>
    </div>
  );
}
