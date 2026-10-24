import { describe, expect, it } from "vitest";
import { toSaveArgs, validateSettings, type ProductSettingsForm } from "../product-settings";

// ค่าตามไฟล์ดีไซน์ Owner-Settings / SKILL §6.2
const base: ProductSettingsForm = {
  sku: "CBL-C-1M",
  name: "สายชาร์จ Type-C 1 เมตร",
  listPrice: 150,
  unitCost: 100,
  floorPrice: 120,
  tiers: [
    { minQty: 500, price: 140 },
    { minQty: 1500, price: 130 },
    { minQty: 3000, price: 125 },
  ],
  cashDiscountPct: 10,
  defaultCreditDays: 30,
  aiEnabled: true,
  costOfCapitalPct: 12,
  escalationDealValue: 300_000,
  gifts: [{ sku: "ADP-20W", enabled: true }],
};
const errorsOf = (patch: Partial<ProductSettingsForm>) => validateSettings({ ...base, ...patch });

describe("validateSettings — กฎราคา (SKILL: AI เสนอต่ำกว่าพื้นไม่ได้)", () => {
  it("ค่าตามดีไซน์ → ผ่าน", () => {
    expect(validateSettings(base)).toEqual({});
  });

  it("ราคาพื้นต่ำกว่าต้นทุน → ไม่ผ่าน", () => {
    expect(errorsOf({ floorPrice: 90 })).toEqual({ floorPrice: "ราคาพื้นต้องไม่ต่ำกว่าต้นทุน ฿100" });
  });

  it("ราคาพื้นสูงกว่าราคาขาย → ไม่ผ่าน", () => {
    expect(errorsOf({ floorPrice: 160 })).toMatchObject({ floorPrice: "ราคาพื้นต้องไม่เกินราคาขาย ฿150" });
  });

  it("ราคาตามจำนวนต่ำกว่าพื้น → ไม่ผ่าน ชี้ขั้นที่ผิด", () => {
    const tiers = [...base.tiers];
    tiers[2] = { minQty: 3000, price: 115 };
    expect(errorsOf({ tiers })).toEqual({ "tiers.2.price": "ต่ำกว่าราคาพื้น ฿120" });
  });

  it("ขึ้นราคาพื้นจนขั้นเดิมต่ำกว่าพื้น → ไม่ผ่านทุกขั้นที่ต่ำกว่า", () => {
    expect(errorsOf({ floorPrice: 135 })).toEqual({
      "tiers.1.price": "ต่ำกว่าราคาพื้น ฿135",
      "tiers.2.price": "ต่ำกว่าราคาพื้น ฿135",
    });
  });

  it("ราคาตามจำนวนสูงกว่าราคาขาย → ไม่ผ่าน", () => {
    expect(errorsOf({ tiers: [{ minQty: 500, price: 155 }] })).toEqual({ "tiers.0.price": "ต้องไม่เกินราคาขาย ฿150" });
  });

  it("สั่งเยอะกว่าแต่ราคาแพงกว่าขั้นก่อน → ไม่ผ่าน", () => {
    expect(
      errorsOf({
        tiers: [
          { minQty: 500, price: 130 },
          { minQty: 1500, price: 140 },
        ],
      }),
    ).toEqual({ "tiers.1.price": "สั่งเยอะกว่าต้องราคาไม่สูงกว่าขั้นก่อน" });
  });

  it("จำนวนขั้นต่ำซ้ำ / ไม่ใช่จำนวนเต็ม → ไม่ผ่าน", () => {
    expect(
      errorsOf({
        tiers: [
          { minQty: 500, price: 140 },
          { minQty: 500, price: 130 },
        ],
      }),
    ).toEqual({ "tiers.1.minQty": "จำนวนซ้ำกับขั้นอื่น" });
    expect(errorsOf({ tiers: [{ minQty: 10.5, price: 140 }] })).toEqual({
      "tiers.0.minQty": "ใส่จำนวนเต็มตั้งแต่ 1 ชิ้น",
    });
  });

  it("ไม่มีขั้นราคาตามจำนวนเลยก็ได้ (AI ไม่เสนอข้อซื้อเยอะ)", () => {
    expect(errorsOf({ tiers: [] })).toEqual({});
  });

  it("ชื่อว่าง → ไม่ผ่าน", () => {
    expect(errorsOf({ name: " " })).toEqual({ name: "ใส่ชื่อสินค้า (ไม่เกิน 80 ตัวอักษร)" });
  });

  it("ช่องว่าง (NaN) → บอกให้ใส่ตัวเลข", () => {
    expect(errorsOf({ listPrice: Number.NaN })).toMatchObject({ listPrice: "ใส่ราคาขายมากกว่า 0" });
  });
});

describe("validateSettings — เงื่อนไขแลกส่วนลด / เกณฑ์ส่งเถ้าแก่", () => {
  it.each([
    [{ cashDiscountPct: 60 }, "cashDiscountPct", "ใส่ 0–50%"],
    [{ cashDiscountPct: -1 }, "cashDiscountPct", "ใส่ 0–50%"],
    [{ defaultCreditDays: 400 }, "defaultCreditDays", "ใส่ 0–365 วัน"],
    [{ defaultCreditDays: 7.5 }, "defaultCreditDays", "ใส่ 0–365 วัน"],
    [{ costOfCapitalPct: 150 }, "costOfCapitalPct", "ใส่ 0–100% ต่อปี"],
    [{ escalationDealValue: 0 }, "escalationDealValue", "ใส่มูลค่ามากกว่า 0"],
  ] as const)("%o → %s ไม่ผ่าน", (patch, field, message) => {
    expect(errorsOf(patch)).toEqual({ [field]: message });
  });

  it("ขั้นราคาตามจำนวนเกิน 10 ขั้น → ไม่ผ่าน", () => {
    const tiers = Array.from({ length: 11 }, (_, i) => ({ minQty: (i + 1) * 100, price: 140 - i }));
    expect(errorsOf({ tiers })).toEqual({ tiers: "ตั้งได้ไม่เกิน 10 ขั้น" });
  });
});

describe("ค่าระดับร้านไม่ได้แก้ (null)", () => {
  it("ไม่ตรวจ และส่ง null ให้ฐานข้อมูลใช้ค่าเดิม", () => {
    const form = { ...base, costOfCapitalPct: null, escalationDealValue: null };
    expect(validateSettings(form)).toEqual({});
    expect(toSaveArgs(form)).toMatchObject({ p_cost_of_capital_annual: null, p_escalation_deal_value: null });
  });
});

describe("toSaveArgs", () => {
  it("แปลง % เป็นสัดส่วน และเรียงขั้นตามจำนวน", () => {
    const args = toSaveArgs({
      ...base,
      tiers: [
        { minQty: 1500, price: 130 },
        { minQty: 500, price: 140 },
      ],
    });
    expect(args).toMatchObject({
      p_sku: "CBL-C-1M",
      p_name: "สายชาร์จ Type-C 1 เมตร",
      p_list_price: 150,
      p_unit_cost: 100,
      p_floor_price: 120,
      p_tiers: [
        { minQty: 500, price: 140 },
        { minQty: 1500, price: 130 },
      ],
      p_cash_discount_pct: 0.1,
      p_default_credit_days: 30,
      p_ai_enabled: true,
      p_cost_of_capital_annual: 0.12,
      p_escalation_deal_value: 300_000,
      p_gifts: [{ sku: "ADP-20W", enabled: true }],
    });
  });
});
