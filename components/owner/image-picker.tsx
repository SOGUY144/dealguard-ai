"use client";

// ใส่/เปลี่ยน/ลบรูปสินค้า — ย่อรูปในเครื่องก่อนส่ง (ด้านยาว 800px, WebP) ให้ไฟล์เล็กและโหลดเร็วในแชตลูกค้า
import { ImagePlus, LoaderCircle, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { ProductThumb } from "@/components/ui/product-thumb";
import { buttonClass } from "@/components/ui/button";
import type { ImageResult } from "@/lib/owner/catalog-rules";
import type { SaveResult } from "@/lib/owner/product-settings";

const MAX_SIDE = 800;

/** ย่อรูป → WebP (เบราว์เซอร์ที่ทำ WebP ไม่ได้ใช้ JPEG) */
export async function shrinkImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const encode = (type: string) => new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.85));
  const webp = await encode("image/webp");
  if (webp?.type === "image/webp") return webp;
  const jpeg = await encode("image/jpeg");
  if (!jpeg) throw new Error("encode failed");
  return jpeg;
}

type Props = {
  kind: "product" | "gift";
  sku: string;
  name: string;
  imageUrl?: string;
  upload: (form: FormData) => Promise<ImageResult>;
  remove: (kind: "product" | "gift", sku: string) => Promise<SaveResult>;
  onChanged: () => void;
  /** test ใส่ตัวย่อรูปปลอมได้ (jsdom ไม่มี canvas) */
  shrink?: (file: File) => Promise<Blob>;
};

export function ImagePicker({ kind, sku, name, imageUrl, upload, remove, onChanged, shrink = shrinkImage }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState(imageUrl);
  const [busy, setBusy] = useState<"upload" | "remove" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    setBusy("upload");
    try {
      let blob: Blob;
      try {
        blob = await shrink(file);
      } catch {
        setError("อ่านรูปนี้ไม่ได้ ลองใช้ไฟล์ JPG หรือ PNG");
        return;
      }
      const form = new FormData();
      form.set("kind", kind);
      form.set("sku", sku);
      form.set("file", new File([blob], `${sku}.${blob.type === "image/webp" ? "webp" : "jpg"}`, { type: blob.type }));
      const result = await upload(form);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setPreview(result.imageUrl);
      onChanged();
    } catch {
      setError("อัปโหลดรูปไม่สำเร็จ ลองใหม่อีกครั้ง");
    } finally {
      setBusy(null);
      if (input.current) input.current.value = "";
    }
  }

  async function onRemove() {
    setError(null);
    setBusy("remove");
    try {
      const result = await remove(kind, sku);
      if (!result.ok) {
        setError(result.errors.form ?? "ลบรูปไม่สำเร็จ ลองใหม่อีกครั้ง");
        return;
      }
      setPreview(undefined);
      onChanged();
    } catch {
      setError("ลบรูปไม่สำเร็จ ลองใหม่อีกครั้ง");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <ProductThumb src={preview} className="size-16 rounded-2xl" />
      <div className="flex flex-col gap-1.5">
        <div className="flex flex-wrap gap-2">
          <input
            ref={input}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/*"
            className="sr-only"
            aria-label={`เลือกรูป${name}`}
            tabIndex={-1}
            onChange={(e) => void onFile(e.target.files?.[0])}
          />
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => input.current?.click()}
            className={buttonClass("secondary", "h-10 px-4 text-[13px] font-medium")}
          >
            {busy === "upload" ? (
              <LoaderCircle aria-hidden="true" size={15} className="motion-safe:animate-spin" />
            ) : (
              <ImagePlus aria-hidden="true" size={15} />
            )}
            {preview ? "เปลี่ยนรูป" : "ใส่รูป"}
          </button>
          {preview && (
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => void onRemove()}
              className={buttonClass("ghost", "h-10 px-3 text-[13px] font-medium")}
            >
              <Trash2 aria-hidden="true" size={15} />
              ลบรูป
            </button>
          )}
        </div>
        {error ? (
          <span role="alert" className="text-xs text-warn-ink">
            {error}
          </span>
        ) : (
          <span className="text-xs text-muted">ลูกค้าเห็นรูปนี้ในรายการสินค้าและในแชต</span>
        )}
      </div>
    </div>
  );
}
