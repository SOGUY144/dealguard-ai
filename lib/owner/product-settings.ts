// ฟอร์มตั้งค่าสินค้า (Owner-Settings) — ตรวจกฎราคาก่อนบันทึก ใช้ทั้งในหน้าจอ (บอกข้อผิดตรงช่อง) และ server (บังคับจริง)
// ข้อความแจ้งข้อผิดไม่มีในไฟล์ดีไซน์ แต่งเพิ่ม ต้องให้ทีมตรวจ · ฐานข้อมูลมี check constraint ซ้ำอีกชั้น
import { z } from "zod";
import { formatBaht } from "@/lib/format";

/** รูปร่างข้อมูลที่ browser ส่งมา (เชื่อไม่ได้) — ค่าที่ผิดกฎปล่อยผ่าน ให้ validateSettings บอกเป็นรายช่อง */
export const productSettingsSchema = z.object({
  sku: z.string().min(1).max(64),
  name: z.string().max(200),
  listPrice: z.number(),
  unitCost: z.number(),
  floorPrice: z.number(),
  tiers: z.array(z.object({ minQty: z.number(), price: z.number() })).max(50),
  cashDiscountPct: z.number(),
  defaultCreditDays: z.number(),
  aiEnabled: z.boolean(),
  costOfCapitalPct: z.number(),
  escalationDealValue: z.number(),
  gifts: z.array(z.object({ sku: z.string().min(1).max(64), enabled: z.boolean() })).max(50),
});

export type ProductSettingsForm = {
  sku: string;
  name: string;
  listPrice: number;
  unitCost: number;
  floorPrice: number;
  tiers: { minQty: number; price: number }[];
  /** % ที่ลดเพิ่มเมื่อจ่ายสด (10 = 10%) */
  cashDiscountPct: number;
  defaultCreditDays: number;
  aiEnabled: boolean;
  /** % ต่อปี (12 = 12%) */
  costOfCapitalPct: number;
  escalationDealValue: number;
  /** ของค้างสต๊อกที่ใช้เป็นของแถมได้ */
  gifts: { sku: string; enabled: boolean }[];
};

/** ของค้างสต๊อกที่ใช้เป็นของแถมได้ (ข้อ C) */
export type GiftInfo = {
  sku: string;
  name: string;
  unitCost: number;
  perceivedValue: number;
  qtyAvailable: number;
  enabled: boolean;
  imageUrl?: string;
};
export type ProductSettingsPage = { products: (ProductSettingsForm & { imageUrl?: string })[]; gifts: GiftInfo[] };

/** key = ชื่อช่อง เช่น "floorPrice" หรือ "tiers.2.price" · ว่าง = ผ่าน */
export type FieldErrors = Record<string, string>;

export type SaveResult = { ok: true } | { ok: false; errors: FieldErrors };

export const MAX_TIERS = 10;

const isNum = (n: number) => Number.isFinite(n);
const isInt = (n: number) => Number.isInteger(n);

export function validateSettings(f: ProductSettingsForm): FieldErrors {
  const errors: FieldErrors = {};

  const name = f.name.trim();
  if (!name || name.length > 80) errors.name = "ใส่ชื่อสินค้า (ไม่เกิน 80 ตัวอักษร)";
  if (!isNum(f.listPrice) || f.listPrice <= 0) errors.listPrice = "ใส่ราคาขายมากกว่า 0";
  if (!isNum(f.unitCost) || f.unitCost < 0) errors.unitCost = "ใส่ต้นทุนตั้งแต่ 0";
  if (!isNum(f.floorPrice)) errors.floorPrice = "ใส่ราคาพื้น";
  else if (isNum(f.unitCost) && f.floorPrice < f.unitCost) errors.floorPrice = `ราคาพื้นต้องไม่ต่ำกว่าต้นทุน ${formatBaht(f.unitCost)}`;
  else if (isNum(f.listPrice) && f.floorPrice > f.listPrice) errors.floorPrice = `ราคาพื้นต้องไม่เกินราคาขาย ${formatBaht(f.listPrice)}`;

  if (f.tiers.length > MAX_TIERS) {
    errors.tiers = `ตั้งได้ไม่เกิน ${MAX_TIERS} ขั้น`;
  } else {
    const seen = new Set<number>();
    f.tiers.forEach((t, i) => {
      if (!isInt(t.minQty) || t.minQty < 1) errors[`tiers.${i}.minQty`] = "ใส่จำนวนเต็มตั้งแต่ 1 ชิ้น";
      else if (seen.has(t.minQty)) errors[`tiers.${i}.minQty`] = "จำนวนซ้ำกับขั้นอื่น";
      seen.add(t.minQty);

      if (!isNum(t.price) || t.price <= 0) errors[`tiers.${i}.price`] = "ใส่ราคาต่อชิ้น";
      else if (isNum(f.floorPrice) && t.price < f.floorPrice) errors[`tiers.${i}.price`] = `ต่ำกว่าราคาพื้น ${formatBaht(f.floorPrice)}`;
      else if (isNum(f.listPrice) && t.price > f.listPrice) errors[`tiers.${i}.price`] = `ต้องไม่เกินราคาขาย ${formatBaht(f.listPrice)}`;
    });

    // เรียงตามจำนวน: สั่งเยอะกว่าต้องราคาไม่แพงกว่า (ไม่งั้นข้อ "ซื้อเยอะ" จะแพงขึ้น)
    const ordered = f.tiers
      .map((t, i) => ({ ...t, i }))
      .filter((t) => !errors[`tiers.${t.i}.minQty`] && !errors[`tiers.${t.i}.price`])
      .sort((a, b) => a.minQty - b.minQty);
    for (let k = 1; k < ordered.length; k++) {
      if (ordered[k].price > ordered[k - 1].price) errors[`tiers.${ordered[k].i}.price`] = "สั่งเยอะกว่าต้องราคาไม่สูงกว่าขั้นก่อน";
    }
  }

  if (!isNum(f.cashDiscountPct) || f.cashDiscountPct < 0 || f.cashDiscountPct > 50) errors.cashDiscountPct = "ใส่ 0–50%";
  if (!isInt(f.defaultCreditDays) || f.defaultCreditDays < 0 || f.defaultCreditDays > 365)
    errors.defaultCreditDays = "ใส่ 0–365 วัน";
  if (!isNum(f.costOfCapitalPct) || f.costOfCapitalPct < 0 || f.costOfCapitalPct > 100)
    errors.costOfCapitalPct = "ใส่ 0–100% ต่อปี";
  if (!isNum(f.escalationDealValue) || f.escalationDealValue <= 0) errors.escalationDealValue = "ใส่มูลค่ามากกว่า 0";

  return errors;
}

/** อาร์กิวเมนต์ของ RPC save_product_settings — % เป็นสัดส่วน ขั้นเรียงตามจำนวน */
export function toSaveArgs(f: ProductSettingsForm) {
  return {
    p_sku: f.sku,
    p_name: f.name.trim(),
    p_list_price: f.listPrice,
    p_unit_cost: f.unitCost,
    p_floor_price: f.floorPrice,
    p_tiers: [...f.tiers].sort((a, b) => a.minQty - b.minQty).map(({ minQty, price }) => ({ minQty, price })),
    p_cash_discount_pct: f.cashDiscountPct / 100,
    p_default_credit_days: f.defaultCreditDays,
    p_ai_enabled: f.aiEnabled,
    p_cost_of_capital_annual: f.costOfCapitalPct / 100,
    p_escalation_deal_value: f.escalationDealValue,
    p_gifts: f.gifts.map(({ sku, enabled }) => ({ sku, enabled })),
  };
}
