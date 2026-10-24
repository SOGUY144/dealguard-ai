"use client";

// เพิ่มสินค้าขาย หรือของแถม (ไม่มีในไฟล์ดีไซน์ — ปุ่ม "เพิ่มสินค้า" ของ Owner-Settings) · ขั้นราคาตามจำนวนตั้งต่อในหน้าสินค้า
import { useState } from "react";
import { buttonClass } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { validateGift, validateNewProduct, type GiftForm, type NewProduct } from "@/lib/owner/catalog-rules";
import type { FieldErrors, SaveResult } from "@/lib/owner/product-settings";
import { Field, Hidden, Modal, StatusLine, type Status } from "./settings-ui";

type Kind = "product" | "gift";
type Props = {
  takenSkus: string[];
  addProduct: (p: NewProduct) => Promise<SaveResult>;
  addGift: (g: GiftForm) => Promise<SaveResult>;
  onAdded: (kind: Kind, sku: string) => void;
  onClose: () => void;
};

const toNum = (s: string) => (s.trim() === "" ? Number.NaN : Number(s.replace(/,/g, "")));

export function AddItemDialog({ takenSkus, addProduct, addGift, onAdded, onClose }: Props) {
  const [kind, setKind] = useState<Kind>("product");
  const [v, setV] = useState({
    name: "",
    sku: "",
    listPrice: "",
    unitCost: "",
    floorPrice: "",
    cashDiscountPct: "0",
    defaultCreditDays: "30",
    perceivedValue: "",
    qtyAvailable: "",
  });
  const [tried, setTried] = useState(false);
  const [serverErrors, setServerErrors] = useState<FieldErrors>({});
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const product: NewProduct = {
    sku: v.sku.trim(),
    name: v.name,
    listPrice: toNum(v.listPrice),
    unitCost: toNum(v.unitCost),
    floorPrice: toNum(v.floorPrice),
    cashDiscountPct: toNum(v.cashDiscountPct),
    defaultCreditDays: toNum(v.defaultCreditDays),
  };
  const gift: GiftForm = {
    sku: v.sku.trim(),
    name: v.name,
    unitCost: toNum(v.unitCost),
    perceivedValue: toNum(v.perceivedValue),
    qtyAvailable: toNum(v.qtyAvailable),
    enabled: true,
  };
  const ruleErrors = kind === "product" ? validateNewProduct(product, takenSkus) : validateGift(gift, takenSkus);
  // ฟอร์มเปล่าไม่ขึ้นสีส้มทันที — แสดงหลังกดเพิ่มครั้งแรก
  const errors: FieldErrors = tried ? { ...ruleErrors, ...serverErrors } : serverErrors;
  const set = (key: keyof typeof v) => (value: string) => {
    setV((prev) => ({ ...prev, [key]: value }));
    setServerErrors({});
    setStatus({ kind: "idle" });
  };

  async function onSubmit() {
    setTried(true);
    if (Object.keys(ruleErrors).length > 0) {
      setStatus({ kind: "error", message: "ยังเพิ่มไม่ได้ แก้ช่องที่ขึ้นสีส้มก่อน" });
      return;
    }
    setStatus({ kind: "saving" });
    try {
      const result = kind === "product" ? await addProduct(product) : await addGift(gift);
      if (result.ok) {
        onAdded(kind, v.sku.trim());
        return;
      }
      const { form: formError, ...fieldErrors } = result.errors;
      setServerErrors(fieldErrors);
      setStatus({ kind: "error", message: formError ?? "ยังเพิ่มไม่ได้ แก้ช่องที่ขึ้นสีส้มก่อน" });
    } catch {
      setStatus({ kind: "error", message: "เพิ่มไม่สำเร็จ ลองใหม่อีกครั้ง" });
    }
  }

  return (
    <Modal title="เพิ่มสินค้า" onClose={onClose}>
      <div role="radiogroup" aria-label="ประเภท" className="grid grid-cols-2 gap-1 rounded-full bg-accent-tint/80 p-1">
        {(
          [
            ["product", "สินค้าที่ขาย"],
            ["gift", "ของแถม (ของค้างสต๊อก)"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={kind === value}
            onClick={() => {
              setKind(value);
              setStatus({ kind: "idle" });
            }}
            className={cn(
              "h-10 rounded-full text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
              kind === value ? "bg-white font-semibold text-accent-ink shadow-[0_4px_12px_rgba(110,90,170,0.14)]" : "font-medium",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void onSubmit();
        }}
        className="flex flex-col gap-3.5"
      >
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(200px,100%),1fr))] gap-3.5">
          <Field label="ชื่อสินค้า" type="text" maxLength={80} autoFocus value={v.name} onChange={set("name")} error={errors.name} />
          <Field
            label="รหัสสินค้า (SKU)"
            type="text"
            maxLength={32}
            value={v.sku}
            onChange={set("sku")}
            error={errors.sku}
            hint="ตัวอังกฤษ ตัวเลข - หรือ _ เช่น CBL-L-1M"
          />
        </div>
        {kind === "product" ? (
          <>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(140px,100%),1fr))] gap-3.5">
              <Field label="ราคาขาย" prefix="฿" value={v.listPrice} onChange={set("listPrice")} error={errors.listPrice} />
              <Field label={<>ต้นทุน <Hidden /></>} prefix="฿" value={v.unitCost} onChange={set("unitCost")} error={errors.unitCost} />
              <Field label={<>ราคาพื้น <Hidden /></>} prefix="฿" value={v.floorPrice} onChange={set("floorPrice")} error={errors.floorPrice} emphasis />
            </div>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(140px,100%),1fr))] gap-3.5">
              <Field label="ลดเพิ่มเมื่อจ่ายสด" suffix="%" value={v.cashDiscountPct} onChange={set("cashDiscountPct")} error={errors.cashDiscountPct} />
              <Field label="เครดิตปกติ" suffix="วัน" value={v.defaultCreditDays} onChange={set("defaultCreditDays")} error={errors.defaultCreditDays} />
            </div>
            <span className="text-xs text-muted">ราคาตามจำนวนและรูปสินค้า ตั้งต่อได้หลังเพิ่มแล้ว</span>
          </>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(140px,100%),1fr))] gap-3.5">
            <Field label={<>ต้นทุนต่อชิ้น <Hidden /></>} prefix="฿" value={v.unitCost} onChange={set("unitCost")} error={errors.unitCost} />
            <Field label="ลูกค้ารู้สึกว่าคุ้ม" prefix="฿" value={v.perceivedValue} onChange={set("perceivedValue")} error={errors.perceivedValue} />
            <Field label="เหลือในสต๊อก" suffix="ชิ้น" value={v.qtyAvailable} onChange={set("qtyAvailable")} error={errors.qtyAvailable} />
          </div>
        )}
        <div className="flex flex-wrap justify-end gap-3 pt-1">
          <button type="button" onClick={onClose} className={buttonClass("secondary", "h-12 px-5 font-medium")}>
            ยกเลิก
          </button>
          <button type="submit" aria-busy={status.kind === "saving"} disabled={status.kind === "saving"} className={buttonClass("primary", "h-12 px-7 font-semibold")}>
            เพิ่ม
          </button>
        </div>
        <StatusLine status={status} className="text-right" />
      </form>
    </Modal>
  );
}
