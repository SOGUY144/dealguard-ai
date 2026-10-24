"use server";

import { z } from "zod";
import { requireOwner } from "@/lib/auth/dal";
import {
  createProduct,
  deleteItem,
  importProducts,
  removeImage,
  saveGift,
  setImage,
  type ImageResult,
  type ImportResult,
} from "@/lib/owner/catalog";
import { productSettingsSchema, type SaveResult } from "@/lib/owner/product-settings";
import { saveProductSettings } from "@/lib/owner/products";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

// ทุก action: เช็กว่าเป็นเถ้าแก่ก่อน → ตรวจรูปร่างข้อมูล (browser ส่งอะไรมาก็ได้) → ตรวจกฎ → เขียนด้วย service role
const BAD_INPUT: SaveResult = { ok: false, errors: { form: "ข้อมูลไม่ครบ ลองโหลดหน้าใหม่" } };
const FAILED: SaveResult = { ok: false, errors: { form: "บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง" } };

async function run<T>(fallback: T, work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (err) {
    console.error("[owner/products]", err);
    return fallback;
  }
}

const sku = z.string().max(64);
const newProductSchema = z.object({
  sku,
  name: z.string().max(200),
  listPrice: z.number(),
  unitCost: z.number(),
  floorPrice: z.number(),
  cashDiscountPct: z.number(),
  defaultCreditDays: z.number(),
});
const giftSchema = z.object({
  sku,
  name: z.string().max(200),
  unitCost: z.number(),
  perceivedValue: z.number(),
  qtyAvailable: z.number().nullable(),
  enabled: z.boolean(),
});
const kind = z.enum(["product", "gift"]);

/** บันทึกการตั้งค่าสินค้า — มีผลกับแชตลูกค้าข้อความถัดไปทันที */
export async function saveSettings(input: unknown): Promise<SaveResult> {
  await requireOwner();
  const parsed = productSettingsSchema.safeParse(input);
  if (!parsed.success) return BAD_INPUT;
  return run(FAILED, () => saveProductSettings(createSupabaseAdminClient(), parsed.data));
}

export async function addProduct(input: unknown): Promise<SaveResult> {
  await requireOwner();
  const parsed = newProductSchema.safeParse(input);
  if (!parsed.success) return BAD_INPUT;
  return run(FAILED, () => createProduct(createSupabaseAdminClient(), parsed.data));
}

/** own = รหัสเดิมของของแถมที่กำลังแก้ · ไม่ใส่ = เพิ่มของแถมใหม่ */
export async function saveGiftItem(input: unknown, own?: string): Promise<SaveResult> {
  await requireOwner();
  const parsed = giftSchema.safeParse(input);
  const ownSku = sku.optional().safeParse(own);
  if (!parsed.success || !ownSku.success) return BAD_INPUT;
  return run(FAILED, () => saveGift(createSupabaseAdminClient(), parsed.data, ownSku.data));
}

export async function deleteCatalogItem(itemKind: unknown, itemSku: unknown): Promise<SaveResult> {
  await requireOwner();
  const k = kind.safeParse(itemKind);
  const s = sku.min(1).safeParse(itemSku);
  if (!k.success || !s.success) return BAD_INPUT;
  return run<SaveResult>({ ok: false, errors: { form: "ลบไม่สำเร็จ ลองใหม่อีกครั้ง" } }, async () => {
    await deleteItem(createSupabaseAdminClient(), k.data, s.data);
    return { ok: true };
  });
}

/** FormData: kind, sku, file (รูปที่ย่อในหน้าจอแล้ว) */
export async function uploadImage(form: FormData): Promise<ImageResult> {
  await requireOwner();
  const k = kind.safeParse(form.get("kind"));
  const s = sku.min(1).safeParse(form.get("sku"));
  const file = form.get("file");
  if (!k.success || !s.success || !(file instanceof File)) return { ok: false, error: "ข้อมูลไม่ครบ ลองโหลดหน้าใหม่" };
  return run({ ok: false, error: "อัปโหลดรูปไม่สำเร็จ ลองใหม่อีกครั้ง" }, () =>
    setImage(createSupabaseAdminClient(), k.data, s.data, file),
  );
}

export async function deleteImage(itemKind: unknown, itemSku: unknown): Promise<SaveResult> {
  await requireOwner();
  const k = kind.safeParse(itemKind);
  const s = sku.min(1).safeParse(itemSku);
  if (!k.success || !s.success) return BAD_INPUT;
  return run<SaveResult>({ ok: false, errors: { form: "ลบรูปไม่สำเร็จ ลองใหม่อีกครั้ง" } }, async () => {
    await removeImage(createSupabaseAdminClient(), k.data, s.data);
    return { ok: true };
  });
}

const importSchema = z.array(z.object({ line: z.number().int(), product: newProductSchema })).min(1).max(500);

export async function importCatalog(input: unknown): Promise<ImportResult> {
  await requireOwner();
  const parsed = importSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "ข้อมูลในไฟล์ไม่ครบ หรือเกิน 500 แถว" };
  return run<ImportResult>({ ok: false, error: "นำเข้าไม่สำเร็จ ลองใหม่อีกครั้ง" }, () =>
    importProducts(createSupabaseAdminClient(), parsed.data),
  );
}
