import { describe, expect, it } from "vitest";
import {
  importTemplateCsv,
  parseCsv,
  parseImportSheet,
  validateGift,
  validateNewProduct,
  type NewProduct,
} from "../catalog-rules";

const product: NewProduct = {
  sku: "CBL-L-1M",
  name: "สาย Lightning 1 เมตร",
  listPrice: 180,
  unitCost: 110,
  floorPrice: 140,
  cashDiscountPct: 5,
  defaultCreditDays: 30,
};

describe("validateNewProduct", () => {
  it("ค่าครบ → ผ่าน", () => {
    expect(validateNewProduct(product, [])).toEqual({});
  });

  it("รหัสซ้ำกับสินค้า/ของแถมที่มีอยู่ → ไม่ผ่าน", () => {
    expect(validateNewProduct(product, ["CBL-L-1M"])).toEqual({ sku: "รหัสนี้มีอยู่แล้ว" });
  });

  it("รหัสมีภาษาไทย / เว้นวรรค / สั้นเกิน → ไม่ผ่าน", () => {
    for (const sku of ["สาย1", "AB CD", "A", ""]) {
      expect(validateNewProduct({ ...product, sku }, []), sku).toEqual({ sku: "ใช้ตัวอังกฤษ ตัวเลข - หรือ _ 2–32 ตัว" });
    }
  });

  it("ไม่มีชื่อ / ชื่อยาวเกิน → ไม่ผ่าน", () => {
    expect(validateNewProduct({ ...product, name: "  " }, [])).toEqual({ name: "ใส่ชื่อสินค้า (ไม่เกิน 80 ตัวอักษร)" });
    expect(validateNewProduct({ ...product, name: "ก".repeat(81) }, [])).toEqual({ name: "ใส่ชื่อสินค้า (ไม่เกิน 80 ตัวอักษร)" });
  });

  it("กฎราคาเดียวกับหน้าตั้งค่า: พื้นต่ำกว่าต้นทุน → ไม่ผ่าน", () => {
    expect(validateNewProduct({ ...product, floorPrice: 100 }, [])).toEqual({ floorPrice: "ราคาพื้นต้องไม่ต่ำกว่าต้นทุน ฿110" });
  });
});

describe("validateGift", () => {
  const gift = { sku: "CASE-01", name: "เคสใส", unitCost: 8, perceivedValue: 40, qtyAvailable: 300, enabled: true };
  it("ไม่ได้แก้สต๊อก (null) → ไม่ตรวจ", () => {
    expect(validateGift({ ...gift, qtyAvailable: null }, [], "CASE-01")).toEqual({});
  });

  it("ค่าครบ → ผ่าน · แก้ของแถมเดิม ไม่นับรหัสตัวเองว่าซ้ำ", () => {
    expect(validateGift(gift, [])).toEqual({});
    expect(validateGift(gift, ["CASE-01"], "CASE-01")).toEqual({});
  });
  it.each([
    [{ unitCost: -1 }, "unitCost", "ใส่ต้นทุนตั้งแต่ 0"],
    [{ perceivedValue: Number.NaN }, "perceivedValue", "ใส่มูลค่าตั้งแต่ 0"],
    [{ qtyAvailable: 2.5 }, "qtyAvailable", "ใส่จำนวนเต็มตั้งแต่ 0"],
  ] as const)("%o → %s ไม่ผ่าน", (patch, field, message) => {
    expect(validateGift({ ...gift, ...patch }, [])).toEqual({ [field]: message });
  });
});

describe("parseCsv", () => {
  it("รองรับเครื่องหมายคำพูด คอมม่าในช่อง และบรรทัดว่าง", () => {
    expect(parseCsv('sku,name,price\r\nA1,"สาย, 1 เมตร",150\n\n"B""2",เคส,40\n')).toEqual([
      ["sku", "name", "price"],
      ["A1", "สาย, 1 เมตร", "150"],
      ['B"2', "เคส", "40"],
    ]);
  });
  it("ตัด BOM ของไฟล์ที่บันทึกจาก Excel", () => {
    expect(parseCsv("﻿sku\nA1")).toEqual([["sku"], ["A1"]]);
  });
});

describe("parseImportSheet", () => {
  const existing = [{ sku: "CBL-C-1M", tiers: [{ minQty: 500, price: 140 }, { minQty: 3000, price: 125 }] }];

  it("หัวตารางภาษาไทยหรืออังกฤษ · ไม่ใส่ลดจ่ายสด/เครดิต ใช้ค่า 0% / 30 วัน", () => {
    const result = parseImportSheet(
      [
        ["รหัสสินค้า", "ชื่อสินค้า", "ราคาขาย", "ต้นทุน", "ราคาพื้น"],
        ["CBL-L-1M", "สาย Lightning", 180, 110, "140"],
      ],
      existing,
    );
    expect(result).toEqual({
      ok: true,
      rows: [
        {
          line: 2,
          action: "create",
          product: { sku: "CBL-L-1M", name: "สาย Lightning", listPrice: 180, unitCost: 110, floorPrice: 140, cashDiscountPct: 0, defaultCreditDays: 30 },
          errors: {},
        },
      ],
    });
  });

  it("รหัสเดิม = แก้ราคา · ราคาพื้นใหม่สูงกว่าขั้นราคาเดิม → แจ้งแถวนั้น", () => {
    const result = parseImportSheet(
      [
        ["sku", "name", "list_price", "unit_cost", "floor_price", "cash_discount_pct", "credit_days"],
        ["CBL-C-1M", "สายชาร์จ Type-C 1 เมตร", 150, 100, 130, 10, 30],
      ],
      existing,
    );
    expect(result.ok && result.rows[0]).toMatchObject({
      action: "update",
      errors: { floorPrice: "ขั้นราคาเดิม (฿125) ต่ำกว่าราคาพื้นใหม่ แก้ขั้นในหน้าสินค้าก่อน" },
    });
  });

  it("แถวที่ผิดบอกเลขบรรทัดในไฟล์ · รหัสซ้ำในไฟล์เดียวกัน → แจ้ง", () => {
    const result = parseImportSheet(
      [
        ["sku", "name", "list_price", "unit_cost", "floor_price"],
        ["A-1", "ของ A", 100, 120, 110],
        ["A-1", "ของ A ซ้ำ", 100, 50, 60],
      ],
      [],
    );
    expect(result.ok && result.rows.map((r) => [r.line, Object.keys(r.errors)])).toEqual([
      [2, ["floorPrice"]],
      [3, ["sku"]],
    ]);
  });

  it("ไม่มีคอลัมน์ที่ต้องมี → บอกว่าขาดคอลัมน์ไหน", () => {
    expect(parseImportSheet([["sku", "name"], ["A-1", "x"]], [])).toEqual({
      ok: false,
      error: "ไม่พบคอลัมน์: ราคาขาย, ต้นทุน, ราคาพื้น",
    });
  });

  it("ไฟล์ว่าง / ข้ามแถวว่าง", () => {
    expect(parseImportSheet([], [])).toEqual({ ok: false, error: "ไฟล์ไม่มีข้อมูล" });
    expect(parseImportSheet([["sku", "name", "ราคาขาย", "ต้นทุน", "ราคาพื้น"], [null, null, null, null, null]], [])).toEqual({
      ok: false,
      error: "ไฟล์ไม่มีข้อมูลสินค้า",
    });
  });
});

describe("importTemplateCsv", () => {
  it("หัวตารางภาษาไทย + สินค้าปัจจุบันเป็นตัวอย่าง", () => {
    const csv = importTemplateCsv([{ sku: "CBL-C-1M", name: "สายชาร์จ Type-C 1 เมตร", listPrice: 150, unitCost: 100, floorPrice: 120, cashDiscountPct: 10, defaultCreditDays: 30 }]);
    expect(csv).toBe(
      "﻿รหัสสินค้า,ชื่อสินค้า,ราคาขาย,ต้นทุน,ราคาพื้น,ลดจ่ายสด (%),เครดิต (วัน)\r\nCBL-C-1M,สายชาร์จ Type-C 1 เมตร,150,100,120,10,30\r\n",
    );
  });
});

describe("รีวิวรอบ 3 — นำเข้าไม่ทับเงื่อนไขเดิม / ช่อง % ของ Excel", () => {
  const existing = [{ sku: "CBL-C-1M", tiers: [], cashDiscountPct: 10, defaultCreditDays: 0 }];

  it("แก้ราคาสินค้าเดิมด้วยไฟล์ที่ไม่มีคอลัมน์ลดจ่ายสด/เครดิต → ใช้ค่าเดิมของสินค้า ไม่รีเซ็ตเป็น 0% / 30 วัน", () => {
    const result = parseImportSheet([["sku", "name", "ราคาขาย", "ต้นทุน", "ราคาพื้น"], ["CBL-C-1M", "สาย", 150, 100, 120]], existing);
    expect(result.ok && result.rows[0].product).toMatchObject({ cashDiscountPct: 10, defaultCreditDays: 0 });
  });

  it("ช่องว่างในคอลัมน์ที่มี → ใช้ค่าเดิมเหมือนกัน · สินค้าใหม่ใช้ค่าเริ่มต้น", () => {
    const result = parseImportSheet(
      [
        ["sku", "name", "ราคาขาย", "ต้นทุน", "ราคาพื้น", "ลดจ่ายสด (%)", "เครดิต (วัน)"],
        ["CBL-C-1M", "สาย", 150, 100, 120, "", null],
        ["NEW-1", "ใหม่", 50, 20, 30, "", ""],
      ],
      existing,
    );
    expect(result.ok && result.rows.map((r) => [r.product.cashDiscountPct, r.product.defaultCreditDays])).toEqual([
      [10, 0],
      [0, 30],
    ]);
  });

  it('ช่องรูปแบบ % ใน Excel (อ่านได้ 0.05) = 5% · ข้อความ "5%" = 5%', () => {
    const result = parseImportSheet(
      [
        ["sku", "name", "ราคาขาย", "ต้นทุน", "ราคาพื้น", "ลดจ่ายสด (%)"],
        ["A-1", "ก", 100, 50, 80, 0.05],
        ["A-2", "ข", 100, 50, 80, "5%"],
      ],
      [],
    );
    expect(result.ok && result.rows.map((r) => r.product.cashDiscountPct)).toEqual([5, 5]);
  });
});
