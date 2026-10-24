"use client";

// ตั้งค่าของแถม (ของค้างสต๊อกที่ AI ใช้เป็นข้อ C) — ไม่มีในไฟล์ดีไซน์ ทำให้เข้าชุดกับหน้าสินค้า
import { Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { buttonClass } from "@/components/ui/button";
import { validateGift, type GiftForm, type ImageResult } from "@/lib/owner/catalog-rules";
import type { FieldErrors, GiftInfo, SaveResult } from "@/lib/owner/product-settings";
import { ImagePicker } from "./image-picker";
import { Divider, Field, Hidden, StatusLine, Switch, type Status } from "./settings-ui";

export type GiftActions = {
  saveGift: (g: GiftForm, own?: string) => Promise<SaveResult>;
  uploadImage: (form: FormData) => Promise<ImageResult>;
  deleteImage: (kind: "product" | "gift", sku: string) => Promise<SaveResult>;
};

type Draft = { name: string; unitCost: string; perceivedValue: string; qtyAvailable: string; enabled: boolean };
const toDraft = (g: GiftInfo): Draft => ({
  name: g.name,
  unitCost: String(g.unitCost),
  perceivedValue: String(g.perceivedValue),
  qtyAvailable: String(g.qtyAvailable),
  enabled: g.enabled,
});
const toNum = (s: string) => (s.trim() === "" ? Number.NaN : Number(s.replace(/,/g, "")));

type Props = {
  gift: GiftInfo;
  actions: GiftActions;
  onSaved: () => void;
  onDelete: () => void;
  onDirtyChange?: (dirty: boolean) => void;
  shrink?: (file: File) => Promise<Blob>;
};

export function GiftPanel({ gift, actions, onSaved, onDelete, onDirtyChange, shrink }: Props) {
  const [draft, setDraft] = useState(() => toDraft(gift));
  // สต๊อกตอนเริ่มแก้ — เทียบกับค่านี้ (ไม่ใช่ค่าล่าสุดหลังรีเฟรช) ว่าเถ้าแก่แก้ช่องสต๊อกเองไหม
  const [baseQty, setBaseQty] = useState(() => String(gift.qtyAvailable));
  const [serverErrors, setServerErrors] = useState<FieldErrors>({});
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const form: GiftForm = useMemo(
    () => ({
      sku: gift.sku,
      name: draft.name,
      unitCost: toNum(draft.unitCost),
      perceivedValue: toNum(draft.perceivedValue),
      // ไม่ได้แตะช่องสต๊อก → ไม่ส่ง (ตัวเลขในหน้าจออาจเก่ากว่าสต๊อกจริงที่ออเดอร์หักไปแล้ว)
      qtyAvailable: draft.qtyAvailable === baseQty ? null : toNum(draft.qtyAvailable),
      enabled: draft.enabled,
    }),
    [draft, gift.sku, baseQty],
  );
  const errors = { ...serverErrors, ...validateGift(form, [], gift.sku) };
  const [baseline, setBaseline] = useState(() => JSON.stringify(draft));
  const dirty = JSON.stringify(draft) !== baseline;
  useEffect(() => onDirtyChange?.(dirty), [dirty, onDirtyChange]);
  const edit = (patch: Partial<Draft>) => {
    setDraft((d) => ({ ...d, ...patch }));
    setServerErrors({});
    setStatus({ kind: "idle" });
  };

  async function onSave() {
    if (Object.keys(validateGift(form, [], gift.sku)).length > 0) {
      setStatus({ kind: "error", message: "ยังบันทึกไม่ได้ แก้ช่องที่ขึ้นสีส้มก่อน" });
      return;
    }
    setStatus({ kind: "saving" });
    try {
      const result = await actions.saveGift(form, gift.sku);
      if (result.ok) {
        setStatus({ kind: "saved", message: "บันทึกแล้ว ข้อเสนอถัดไปใช้ค่านี้" });
        setBaseQty(draft.qtyAvailable);
        setBaseline(JSON.stringify(draft));
        onSaved();
        return;
      }
      const { form: formError, ...fieldErrors } = result.errors;
      setServerErrors(fieldErrors);
      setStatus({ kind: "error", message: formError ?? "ยังบันทึกไม่ได้ แก้ช่องที่ขึ้นสีส้มก่อน" });
    } catch {
      setStatus({ kind: "error", message: "บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง" });
    }
  }

  return (
    <section aria-label={`ตั้งค่า${gift.name}`} className="glass flex min-w-0 flex-[999_1_520px] flex-col gap-6 rounded-[26px] px-4 py-5 md:px-6 md:py-[22px]">
      <div className="flex flex-wrap items-center gap-3.5">
        <div className="flex min-w-0 flex-auto flex-col">
          <h2 className="text-xl leading-[1.4] font-semibold">{gift.name}</h2>
          <span className="text-[13px] text-muted">ของแถม · SKU {gift.sku}</span>
        </div>
        <button
          type="button"
          aria-pressed={draft.enabled}
          onClick={() => edit({ enabled: !draft.enabled })}
          className="flex h-11 items-center gap-2.5 rounded-full border border-white/90 bg-white/70 pr-2 pl-4 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          ใช้เป็นของแถม
          <Switch on={draft.enabled} />
        </button>
      </div>

      <ImagePicker
        kind="gift"
        sku={gift.sku}
        name={gift.name}
        imageUrl={gift.imageUrl}
        upload={actions.uploadImage}
        remove={actions.deleteImage}
        onChanged={onSaved}
        shrink={shrink}
      />

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(170px,100%),1fr))] gap-3.5">
        <Field label="ชื่อของแถม" type="text" maxLength={80} value={draft.name} onChange={(v) => edit({ name: v })} error={errors.name} />
        <Field label={<>ต้นทุนต่อชิ้น <Hidden /></>} prefix="฿" value={draft.unitCost} onChange={(v) => edit({ unitCost: v })} error={errors.unitCost} />
        <Field
          label="ลูกค้ารู้สึกว่าคุ้ม"
          prefix="฿"
          value={draft.perceivedValue}
          onChange={(v) => edit({ perceivedValue: v })}
          error={errors.perceivedValue}
          hint="ราคาที่ลูกค้าคิดว่าของชิ้นนี้มีค่า"
        />
        <Field label="เหลือในสต๊อก" suffix="ชิ้น" value={draft.qtyAvailable} onChange={(v) => edit({ qtyAvailable: v })} error={errors.qtyAvailable} />
      </div>

      <Divider />

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={onDelete} className={buttonClass("ghost", "h-11 px-3 text-sm text-warn-ink")}>
          <Trash2 aria-hidden="true" size={16} />
          ลบของแถมนี้
        </button>
        <span className="flex-[1_1_160px]" />
        <button
          type="button"
          onClick={() => {
            edit(toDraft(gift));
            setBaseQty(String(gift.qtyAvailable));
            setBaseline(JSON.stringify(toDraft(gift)));
          }}
          disabled={status.kind === "saving"} className={buttonClass("secondary", "h-12 px-5 font-medium")}>
          ยกเลิก
        </button>
        <button
          type="button"
          onClick={() => void onSave()}
          aria-busy={status.kind === "saving"}
          disabled={status.kind === "saving"}
          className={buttonClass("primary", "h-12 px-7 font-semibold")}
        >
          บันทึก
        </button>
      </div>
      <StatusLine status={status} className="-mt-3 text-right" />
    </section>
  );
}
