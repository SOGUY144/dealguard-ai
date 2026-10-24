"use client";

// เพิ่มสินค้าขาย หรือของแถม (ไม่มีในไฟล์ดีไซน์ — ปุ่ม "เพิ่มสินค้า" ของ Owner-Settings) · ขั้นราคาตามจำนวนตั้งต่อในหน้าสินค้า
// ใส่รูปได้ตั้งแต่ตอนเพิ่ม: ย่อรูปตอนเลือก (เห็นตัวอย่างทันที) · กดเพิ่ม → สร้างสินค้าก่อน แล้วค่อยอัปโหลดรูปให้รหัสนั้น
import { ImagePlus, LoaderCircle, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ProductThumb } from "@/components/ui/product-thumb";
import { buttonClass } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { validateGift, validateNewProduct, type GiftForm, type ImageResult, type NewProduct } from "@/lib/owner/catalog-rules";
import type { FieldErrors, SaveResult } from "@/lib/owner/product-settings";
import { imageForm, shrinkImage } from "./image-picker";
import { Field, Hidden, Modal, StatusLine, type Status } from "./settings-ui";

type Kind = "product" | "gift";
/** รูปตอนเพิ่ม: ไม่ได้เลือก / ใส่แล้ว / สินค้าเพิ่มแล้วแต่รูปพลาด (ข้อความจาก server) */
export type AddedImage = { kind: "none" } | { kind: "ok" } | { kind: "failed"; reason: string };
type Props = {
  takenSkus: string[];
  addProduct: (p: NewProduct) => Promise<SaveResult>;
  addGift: (g: GiftForm) => Promise<SaveResult>;
  uploadImage: (form: FormData) => Promise<ImageResult>;
  onAdded: (kind: Kind, sku: string, image: AddedImage) => void;
  onClose: () => void;
  /** test ใส่ตัวย่อรูปปลอมได้ (jsdom ไม่มี canvas) */
  shrink?: (file: File) => Promise<Blob>;
};

const toNum = (s: string) => (s.trim() === "" ? Number.NaN : Number(s.replace(/,/g, "")));

export function AddItemDialog({ takenSkus, addProduct, addGift, uploadImage, onAdded, onClose, shrink = shrinkImage }: Props) {
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
  const [photo, setPhoto] = useState<Photo>(null);
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
        onAdded(kind, v.sku.trim(), photo ? await uploadPhoto(photo.blob) : { kind: "none" });
        return;
      }
      const { form: formError, ...fieldErrors } = result.errors;
      setServerErrors(fieldErrors);
      setStatus({ kind: "error", message: formError ?? "ยังเพิ่มไม่ได้ แก้ช่องที่ขึ้นสีส้มก่อน" });
    } catch {
      setStatus({ kind: "error", message: "เพิ่มไม่สำเร็จ ลองใหม่อีกครั้ง" });
    }
  }

  /** สินค้าเพิ่มแล้ว — รูปพลาดไม่ทำให้การเพิ่มล้ม (ใส่ใหม่ได้ที่หน้าสินค้า) */
  async function uploadPhoto(blob: Blob): Promise<AddedImage> {
    try {
      const result = await uploadImage(imageForm(kind, v.sku.trim(), blob));
      return result.ok ? { kind: "ok" } : { kind: "failed", reason: result.error };
    } catch {
      return { kind: "failed", reason: "อัปโหลดไม่สำเร็จ" };
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
        <PhotoField photo={photo} onChange={setPhoto} shrink={shrink} disabled={status.kind === "saving"} />
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
            <span className="text-xs text-muted">ราคาตามจำนวน ตั้งต่อได้หลังเพิ่มแล้ว</span>
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

type Photo = { blob: Blob; preview: string } | null;

/** เลือกรูป (ไม่บังคับ) — ย่อรูปทันทีที่เลือก ให้รู้ตั้งแต่ตอนนี้ถ้ารูปเปิดไม่ได้ */
function PhotoField({
  photo,
  onChange,
  shrink,
  disabled,
}: {
  photo: Photo;
  onChange: (p: Photo) => void;
  shrink: (file: File) => Promise<Blob>;
  disabled: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // คืนหน่วยความจำของรูปตัวอย่างเมื่อเปลี่ยน / เอาออก / ปิดหน้าต่าง
  useEffect(
    () => () => {
      if (photo) URL.revokeObjectURL(photo.preview);
    },
    [photo],
  );

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    setReading(true);
    try {
      const blob = await shrink(file);
      onChange({ blob, preview: URL.createObjectURL(blob) });
    } catch {
      setError("อ่านรูปนี้ไม่ได้ ลองใช้ไฟล์ JPG หรือ PNG");
    } finally {
      setReading(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <ProductThumb src={photo?.preview} className="size-16 rounded-2xl" />
      <div className="flex flex-col gap-1.5">
        <div className="flex flex-wrap gap-2">
          <input
            ref={input}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/*"
            className="sr-only"
            aria-label="เลือกรูปสินค้าใหม่"
            tabIndex={-1}
            onChange={(e) => void onFile(e.target.files?.[0])}
          />
          <button
            type="button"
            disabled={disabled || reading}
            onClick={() => input.current?.click()}
            className={buttonClass("secondary", "h-10 px-4 text-[13px] font-medium")}
          >
            {reading ? (
              <LoaderCircle aria-hidden="true" size={15} className="motion-safe:animate-spin" />
            ) : (
              <ImagePlus aria-hidden="true" size={15} />
            )}
            {photo ? "เปลี่ยนรูป" : "ใส่รูป"}
          </button>
          {photo && (
            <button
              type="button"
              disabled={disabled}
              onClick={() => onChange(null)}
              className={buttonClass("ghost", "h-10 px-3 text-[13px] font-medium")}
            >
              <X aria-hidden="true" size={15} />
              เอารูปออก
            </button>
          )}
        </div>
        {error ? (
          <span role="alert" className="text-xs text-warn-ink">
            {error}
          </span>
        ) : (
          <span className="text-xs text-muted">ไม่บังคับ · ลูกค้าเห็นรูปนี้ในรายการสินค้าและในแชต</span>
        )}
      </div>
    </div>
  );
}
