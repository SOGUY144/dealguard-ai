import { describe, expect, it } from "vitest";
import merchant from "@/lib/config/merchant.json";
import type { Product } from "../types";
import { budgetQty, priceGuide, reachPrice } from "../price-guide";

// สายชาร์จ: ราคาขาย 150 · พื้น 120 · ขั้นราคา 500→140, 1,500→130, 3,000→125 · จ่ายสด 10% · เครดิต 30 วัน
const cable: Product = merchant.products[0];

describe("priceGuide — ราคาตามจำนวน (ตัวเลขเดียวกับที่ Deal Engine เสนอ)", () => {
  it("ราคาขาย + ขั้นราคาเรียงตามจำนวน + ราคาจ่ายสด", () => {
    expect(priceGuide(cable)).toEqual({
      listPrice: 150,
      tiers: [
        { minQty: 500, price: 140 },
        { minQty: 1500, price: 130 },
        { minQty: 3000, price: 125 },
      ],
      cashPrice: 135,
    });
  });

  it("ขั้นราคาที่ต่ำกว่าพื้นหรือไม่ถูกกว่าราคาขาย ไม่เอามาบอก · ไม่มีเครดิตอยู่แล้ว = ไม่มีส่วนลดจ่ายสด", () => {
    const odd: Product = {
      ...cable,
      volumeTiers: [
        { minQty: 200, price: 150 },
        { minQty: 900, price: 110 },
        { minQty: 400, price: 145 },
      ],
      defaultCreditDays: 0,
    };
    expect(priceGuide(odd)).toEqual({ listPrice: 150, tiers: [{ minQty: 400, price: 145 }], cashPrice: null });
  });
});

describe("reachPrice — ลูกค้าขอราคานี้ ต้องทำยังไง", () => {
  const guide = priceGuide(cable);
  it("฿150 = ราคาปกติอยู่แล้ว", () => {
    expect(reachPrice(guide, 150)).toEqual({ atList: true, cash: true, tier: { minQty: 500, price: 140 } });
  });
  it("฿140 → จ่ายสด (฿135) หรือสั่ง 500 ชิ้นขึ้นไป", () => {
    expect(reachPrice(guide, 140)).toEqual({ atList: false, cash: true, tier: { minQty: 500, price: 140 } });
  });
  it("฿130 → จ่ายสดยังไม่ถึง ต้องสั่ง 1,500 ชิ้นขึ้นไป", () => {
    expect(reachPrice(guide, 130)).toEqual({ atList: false, cash: false, tier: { minQty: 1500, price: 130 } });
  });
  it("฿110 → ไม่มีทางไหนถึง", () => {
    expect(reachPrice(guide, 110)).toEqual({ atList: false, cash: false, tier: null });
  });
});

describe("budgetQty — งบรวมได้กี่ชิ้น", () => {
  const guide = priceGuide(cable);
  it("320 บาท → 2 ชิ้น ราคาปกติ รวม ฿300", () => {
    expect(budgetQty(guide, 320)).toEqual({ qty: 2, pricePerUnit: 150, total: 300 });
  });
  it("งบถึงขั้นราคา → คิดราคาขั้นนั้น (70,000 → 500 ชิ้น × ฿140)", () => {
    expect(budgetQty(guide, 70_000)).toEqual({ qty: 500, pricePerUnit: 140, total: 70_000 });
  });
  it("งบไม่พอ 1 ชิ้น → null", () => {
    expect(budgetQty(guide, 100)).toBeNull();
  });
});
