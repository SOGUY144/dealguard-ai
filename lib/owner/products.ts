// อ่าน/บันทึกการตั้งค่าสินค้า (หน้า /owner/products)
// อ่านด้วย client ของเถ้าแก่ (RLS: เฉพาะ owner อ่านต้นทุน/ราคาพื้นได้) · บันทึกผ่าน RPC ของ service role หลังเช็กสิทธิ์แล้ว
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { productImageUrl } from "@/lib/products/image-url";
import {
  toSaveArgs,
  validateSettings,
  type GiftInfo,
  type ProductSettingsForm,
  type ProductSettingsPage,
  type SaveResult,
} from "./product-settings";

export type { GiftInfo, ProductSettingsPage, SaveResult } from "./product-settings";

type Row = Record<string, unknown>;
const num = (v: unknown) => Number(v);
const withImage = (path: unknown) => {
  const imageUrl = productImageUrl(typeof path === "string" ? path : null);
  return imageUrl ? { imageUrl } : {};
};

export async function readProductSettings(db: SupabaseClient): Promise<ProductSettingsPage> {
  const res = await db
    .from("merchants")
    .select("cost_of_capital_annual, escalation_deal_value, products(*), dead_stock(*)")
    .order("created_at")
    .order("created_at", { referencedTable: "products" })
    .order("created_at", { referencedTable: "dead_stock" })
    .limit(1)
    .maybeSingle();
  if (res.error) throw new Error(`[owner] อ่านการตั้งค่าสินค้า: ${res.error.message}`);
  // ไม่ใช่ owner → RLS ไม่คืนแถวร้าน
  if (!res.data) return { products: [], gifts: [] };
  const shop = res.data as Row;

  const gifts: GiftInfo[] = (shop.dead_stock as Row[]).map((d) => ({
    sku: String(d.sku),
    name: String(d.name),
    unitCost: num(d.unit_cost),
    perceivedValue: num(d.perceived_value),
    qtyAvailable: num(d.qty_available),
    enabled: d.gift_enabled !== false,
    ...withImage(d.image_path),
  }));
  const products = (shop.products as Row[]).map((p) => ({
    sku: String(p.sku),
    name: String(p.name),
    listPrice: num(p.list_price),
    unitCost: num(p.unit_cost),
    floorPrice: num(p.floor_price),
    tiers: (p.volume_tiers as { minQty: number; price: number }[]).map((t) => ({ minQty: num(t.minQty), price: num(t.price) })),
    // เก็บเป็นสัดส่วน แสดงเป็น % — ปัดกันเศษทศนิยมแบบ 0.1 × 100 = 10.000000000000002
    cashDiscountPct: Math.round(num(p.cash_discount_pct) * 10_000) / 100,
    defaultCreditDays: num(p.default_credit_days),
    aiEnabled: p.ai_enabled !== false,
    costOfCapitalPct: Math.round(num(shop.cost_of_capital_annual) * 10_000) / 100,
    escalationDealValue: num(shop.escalation_deal_value),
    gifts: gifts.map(({ sku, enabled }) => ({ sku, enabled })),
    ...withImage(p.image_path),
  }));
  return { products, gifts };
}

/** ตรวจกฎก่อน ไม่ผ่านไม่บันทึก · ฐานข้อมูลตรวจซ้ำอีกชั้น (check constraint) */
export async function saveProductSettings(admin: SupabaseClient, form: ProductSettingsForm): Promise<SaveResult> {
  const errors = validateSettings(form);
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  const { error } = await admin.rpc("save_product_settings", toSaveArgs(form));
  if (error) throw new Error(`[owner] บันทึกการตั้งค่าสินค้า: ${error.message}`);
  return { ok: true };
}
