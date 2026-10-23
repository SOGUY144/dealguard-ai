import { describe, expect, it } from "vitest";
import { computeEconomics } from "../margin";
import { cable, config } from "./fixtures";

// ตัวอย่างใน SKILL §6.5: list 150, cost 100, ขอ 125 × 1,000, เครดิตปกติ 30 วัน, ทุน 12%/ปี
const request = { referencePrice: 125, qty: 1000 };

describe("computeEconomics", () => {
  it("baseline = กำไรถ้ายอมลดตามที่ขอ", () => {
    const e = computeEconomics(cable, config, request, { pricePerUnit: 130, qty: 1500, creditDays: 30 });
    expect(e.marginIfConceded).toBe(25_000);
  });

  it("A ซื้อเยอะ ฿130 × 1,500 รักษากำไรได้ +฿20,000", () => {
    const e = computeEconomics(cable, config, request, { pricePerUnit: 130, qty: 1500, creditDays: 30 });
    expect(e.marginOffer).toBe(45_000);
    expect(e.recoveredMargin).toBe(20_000);
    expect(e.cashValue).toBe(0);
  });

  it("B จ่ายสด ฿135 × 1,000 นับมูลค่าเงินที่ได้เร็วขึ้น 30 วัน ≈ +฿11,332", () => {
    const e = computeEconomics(cable, config, request, { pricePerUnit: 135, qty: 1000, creditDays: 0 });
    expect(e.cashValue).toBeCloseTo(135_000 * (30 / 365) * 0.12, 6);
    expect(Math.round(e.marginOffer)).toBe(36_332);
    expect(Math.round(e.recoveredMargin)).toBe(11_332);
  });

  it("C ของแถม ฿145 × 1,000 + หัวชาร์จ 200 ชิ้น (ทุน ฿15) หักทุนของแถม +฿17,000", () => {
    const e = computeEconomics(
      cable,
      config,
      request,
      { pricePerUnit: 145, qty: 1000, creditDays: 30 },
      { unitCost: 15, qty: 200 },
    );
    expect(e.bundleCost).toBe(3_000);
    expect(e.marginOffer).toBe(42_000);
    expect(e.recoveredMargin).toBe(17_000);
  });
});
