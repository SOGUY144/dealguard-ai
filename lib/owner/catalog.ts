// เพิ่ม/ลบสินค้า, ของแถม, รูป, นำเข้าจากไฟล์ — ใช้ admin client (service role) หลัง server action เช็กว่าเป็นเถ้าแก่แล้วเท่านั้น
// ตรวจกฎชุดเดียวกับหน้าจอซ้ำก่อนเขียนทุกครั้ง (browser ส่งอะไรมาก็ได้) · ฐานข้อมูลมี check constraint อีกชั้น
import "server-only";
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { PRODUCT_IMAGE_BUCKET, productImageUrl } from "@/lib/products/image-url";
import {
  reviewImport,
  validateGift,
  validateNewProduct,
  type GiftForm,
  type ImageResult,
  type ImportResult,
  type NewProduct,
} from "./catalog-rules";
import type { FieldErrors, SaveResult } from "./product-settings";

type Row = Record<string, unknown>;
export type ImageKind = "product" | "gift";
const TABLE: Record<ImageKind, "products" | "dead_stock"> = { product: "products", gift: "dead_stock" };

/** รูปหลังย่อในหน้าจอแล้ว (800px webp) ราว 50–200 KB — เกิน 900 KB ไม่รับ (server action รับได้ 1 MB) */
export const MAX_IMAGE_BYTES = 900_000;
const IMAGE_TYPES: Record<string, string> = { "image/webp": "webp", "image/jpeg": "jpg", "image/png": "png" };

async function merchantId(admin: SupabaseClient): Promise<string> {
  const { data, error } = await admin.from("merchants").select("id").order("created_at").limit(1).single();
  if (error) throw new Error(`[catalog] อ่านร้าน: ${error.message}`);
  return String((data as Row).id);
}

/** รหัสทั้งร้าน (สินค้า + ของแถม) — รหัสห้ามซ้ำกัน */
async function catalogSkus(admin: SupabaseClient) {
  const [products, gifts] = await Promise.all([
    admin.from("products").select("sku, volume_tiers, cash_discount_pct, default_credit_days"),
    admin.from("dead_stock").select("sku"),
  ]);
  if (products.error) throw new Error(`[catalog] อ่านสินค้า: ${products.error.message}`);
  if (gifts.error) throw new Error(`[catalog] อ่านของแถม: ${gifts.error.message}`);
  return {
    products: (products.data as Row[]).map((p) => ({
      sku: String(p.sku),
      tiers: (p.volume_tiers as { minQty: number; price: number }[]).map((t) => ({ minQty: Number(t.minQty), price: Number(t.price) })),
      cashDiscountPct: Math.round(Number(p.cash_discount_pct) * 10_000) / 100,
      defaultCreditDays: Number(p.default_credit_days),
    })),
    giftSkus: (gifts.data as Row[]).map((g) => String(g.sku)),
  };
}

const failed = (errors: FieldErrors): SaveResult => ({ ok: false, errors });
const hasErrors = (errors: FieldErrors) => Object.keys(errors).length > 0;

export async function createProduct(admin: SupabaseClient, p: NewProduct): Promise<SaveResult> {
  const { products, giftSkus } = await catalogSkus(admin);
  const errors = validateNewProduct(p, [...products.map((x) => x.sku), ...giftSkus]);
  if (hasErrors(errors)) return failed(errors);
  const { error } = await admin.from("products").insert({
    merchant_id: await merchantId(admin),
    sku: p.sku,
    name: p.name.trim(),
    list_price: p.listPrice,
    unit_cost: p.unitCost,
    floor_price: p.floorPrice,
    cash_discount_pct: p.cashDiscountPct / 100,
    default_credit_days: p.defaultCreditDays,
  });
  // กดซ้อนกันสองแท็บ — unique (merchant_id, sku) กันไว้
  if (error?.code === "23505") return failed({ sku: "รหัสนี้มีอยู่แล้ว" });
  if (error) throw new Error(`[catalog] เพิ่มสินค้า: ${error.message}`);
  return { ok: true };
}

/** own = รหัสเดิม (แก้ของแถมที่มีอยู่) · ไม่ใส่ = เพิ่มใหม่ */
export async function saveGift(admin: SupabaseClient, g: GiftForm, own?: string): Promise<SaveResult> {
  const { products, giftSkus } = await catalogSkus(admin);
  if (own && !giftSkus.includes(own)) return failed({ form: "ไม่พบของแถมนี้ ลองโหลดหน้าใหม่" });
  // เพิ่มใหม่ต้องบอกสต๊อก · แก้ของเดิมไม่บอก = ไม่เปลี่ยน (ออเดอร์หักสต๊อกระหว่างเถ้าแก่เปิดหน้าค้างไว้ได้)
  if (!own && g.qtyAvailable === null) return failed({ qtyAvailable: "ใส่จำนวนเต็มตั้งแต่ 0" });
  const errors = validateGift(g, [...products.map((x) => x.sku), ...giftSkus], own);
  if (hasErrors(errors)) return failed(errors);
  const values = {
    name: g.name.trim(),
    unit_cost: g.unitCost,
    perceived_value: g.perceivedValue,
    ...(g.qtyAvailable !== null && { qty_available: g.qtyAvailable }),
    gift_enabled: g.enabled,
  };
  const { error } = own
    ? await admin.from("dead_stock").update(values).eq("sku", own)
    : await admin.from("dead_stock").insert({ ...values, sku: g.sku, merchant_id: await merchantId(admin) });
  if (error?.code === "23505") return failed({ sku: "รหัสนี้มีอยู่แล้ว" });
  if (error) throw new Error(`[catalog] บันทึกของแถม: ${error.message}`);
  return { ok: true };
}

/** ลบสินค้า/ของแถม + รูป — ออเดอร์เก่ายังอยู่ (เก็บชื่อสินค้าไว้ในออเดอร์แล้ว) · ข้อเสนอเก่าของสินค้านี้ยืนยันไม่ได้ */
export async function deleteItem(admin: SupabaseClient, kind: ImageKind, sku: string): Promise<void> {
  const { data, error } = await admin.from(TABLE[kind]).delete().eq("sku", sku).select("image_path");
  if (error) throw new Error(`[catalog] ลบ${kind === "product" ? "สินค้า" : "ของแถม"}: ${error.message}`);
  const paths = (data as Row[]).map((r) => r.image_path).filter((p): p is string => typeof p === "string");
  if (paths.length) await admin.storage.from(PRODUCT_IMAGE_BUCKET).remove(paths);
}

/** ตรวจหัวไฟล์จริง — ไม่เชื่อ content-type ที่ browser บอก */
function sniffImage(bytes: Uint8Array): string | null {
  const starts = (...sig: number[]) => sig.every((b, i) => bytes[i] === b);
  if (starts(0xff, 0xd8, 0xff)) return "image/jpeg";
  if (starts(0x89, 0x50, 0x4e, 0x47)) return "image/png";
  if (starts(0x52, 0x49, 0x46, 0x46) && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50)
    return "image/webp";
  return null;
}

export type { ImageResult, ImportResult } from "./catalog-rules";

export async function setImage(admin: SupabaseClient, kind: ImageKind, sku: string, file: File): Promise<ImageResult> {
  if (file.size === 0 || file.size > MAX_IMAGE_BYTES) return { ok: false, error: "รูปใหญ่เกินไป (ไม่เกิน 900 KB)" };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = sniffImage(bytes);
  if (!type) return { ok: false, error: "ใช้ได้เฉพาะรูป JPG, PNG หรือ WebP" };

  const current = await admin.from(TABLE[kind]).select("image_path").eq("sku", sku).maybeSingle();
  if (current.error) throw new Error(`[catalog] อ่านรูปเดิม: ${current.error.message}`);
  if (!current.data) return { ok: false, error: "ไม่พบสินค้านี้ ลองโหลดหน้าใหม่" };

  // ชื่อไฟล์ใหม่ทุกครั้ง — ไม่ติด cache ของรูปเก่า
  const path = `${kind}/${sku}-${randomUUID()}.${IMAGE_TYPES[type]}`;
  const upload = await admin.storage.from(PRODUCT_IMAGE_BUCKET).upload(path, bytes, { contentType: type, upsert: false });
  if (upload.error) throw new Error(`[catalog] อัปโหลดรูป: ${upload.error.message}`);
  const update = await admin.from(TABLE[kind]).update({ image_path: path }).eq("sku", sku);
  if (update.error) {
    await admin.storage.from(PRODUCT_IMAGE_BUCKET).remove([path]);
    throw new Error(`[catalog] บันทึกรูป: ${update.error.message}`);
  }
  const old = (current.data as Row).image_path;
  if (typeof old === "string") await admin.storage.from(PRODUCT_IMAGE_BUCKET).remove([old]);
  return { ok: true, imageUrl: productImageUrl(path)! };
}

export async function removeImage(admin: SupabaseClient, kind: ImageKind, sku: string): Promise<void> {
  const { data, error } = await admin.from(TABLE[kind]).select("image_path").eq("sku", sku).maybeSingle();
  if (error) throw new Error(`[catalog] อ่านรูปเดิม: ${error.message}`);
  const old = (data as Row | null)?.image_path;
  if (typeof old !== "string") return;
  const update = await admin.from(TABLE[kind]).update({ image_path: null }).eq("sku", sku);
  if (update.error) throw new Error(`[catalog] ลบรูป: ${update.error.message}`);
  await admin.storage.from(PRODUCT_IMAGE_BUCKET).remove([old]);
}

/** นำเข้าทั้งไฟล์ในคำสั่งเดียว — แถวไหนผิดไม่บันทึกเลยสักแถว */
export async function importProducts(admin: SupabaseClient, items: { line: number; product: NewProduct }[]): Promise<ImportResult> {
  const { products, giftSkus } = await catalogSkus(admin);
  const reviewed = reviewImport(items, products, giftSkus);
  const rowErrors = reviewed.filter((r) => hasErrors(r.errors)).map(({ line, errors }) => ({ line, errors }));
  if (rowErrors.length) return { ok: false, rowErrors };
  const { data, error } = await admin.rpc("import_products", {
    p_rows: reviewed.map(({ product: p }) => ({ ...p, name: p.name.trim(), cashDiscountPct: p.cashDiscountPct / 100 })),
  });
  if (error) throw new Error(`[catalog] นำเข้าสินค้า: ${error.message}`);
  return { ok: true, count: Number(data) };
}
