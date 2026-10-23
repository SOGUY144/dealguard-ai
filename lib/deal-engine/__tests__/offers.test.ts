import { describe, expect, it } from "vitest";
import { buildOffers } from "../offers";
import type { MerchantConfig, Product } from "../types";
import { cable, config } from "./fixtures";

const example = { requestedPrice: 125, qty: 1000 };

describe("buildOffers — ตัวอย่างใน SKILL (ขอ ฿125 × 1,000)", () => {
  const offers = buildOffers(cable, config, example).map((p) => p.offer);

  it("ได้ 3 ข้อเสนอเรียง A ซื้อเยอะ / B จ่ายสด / C รับของแถม", () => {
    expect(offers.map((o) => [o.id, o.lever, o.label])).toEqual([
      ["A", "volume", "ซื้อเยอะ"],
      ["B", "cash", "จ่ายสด"],
      ["C", "bundle", "รับของแถม"],
    ]);
  });

  it("A = tier ถัดไป 1 ขั้น: ฿130 × 1,500 เครดิตปกติ", () => {
    expect(offers[0]).toMatchObject({
      pricePerUnit: 130,
      qty: 1500,
      total: 195_000,
      creditDays: 30,
      conditionText: "เมื่อสั่ง 1,500 ชิ้น",
    });
  });

  it("B = ราคาขายลด 10% เมื่อโอนทันที: ฿135 × 1,000 เครดิต 0 วัน", () => {
    expect(offers[1]).toMatchObject({
      pricePerUnit: 135,
      qty: 1000,
      total: 135_000,
      creditDays: 0,
      conditionText: "1,000 ชิ้น · โอนทันที ไม่ใช้เครดิต",
    });
  });

  it("C = ราคาขาย − 20% ของส่วนที่ขอลด แถมจนคุ้มเท่าข้อ B: ฿145 + หัวชาร์จ 200 ชิ้น", () => {
    expect(offers[2]).toMatchObject({
      pricePerUnit: 145,
      qty: 1000,
      total: 145_000,
      creditDays: 30,
      bundle: { name: "หัวชาร์จ 20W", qty: 200 },
      conditionText: "1,000 ชิ้น + หัวชาร์จ 20W 200 ชิ้น",
    });
  });

  it("แนบตัวเลขหลังบ้านของแต่ละข้อเสนอ", () => {
    const recovered = buildOffers(cable, config, example).map((p) =>
      Math.round(p.economics.recoveredMargin),
    );
    expect(recovered).toEqual([20_000, 11_332, 17_000]);
  });
});

describe("buildOffers — กรณีอื่น", () => {
  it("ลูกค้าขอต่ำกว่าราคาพื้น ทุกข้อเสนอยังไม่ต่ำกว่า ฿120", () => {
    const offers = buildOffers(cable, config, { requestedPrice: 90, qty: 1000 });
    expect(offers.length).toBeGreaterThan(0);
    for (const { offer } of offers) expect(offer.pricePerUnit).toBeGreaterThanOrEqual(120);
  });

  it("ไม่ให้ราคาต่ำกว่าที่ลูกค้าขอเอง แม้ tier จะถูกกว่า", () => {
    const [volume] = buildOffers(cable, config, { requestedPrice: 135, qty: 1000 });
    expect(volume.offer).toMatchObject({ lever: "volume", pricePerUnit: 135, qty: 1500 });
  });

  it("ไม่มี tier ที่ใหญ่กว่าจำนวนที่ขอ → ไม่มีข้อเสนอซื้อเยอะ และไล่ id ใหม่", () => {
    const offers = buildOffers(cable, config, { requestedPrice: 125, qty: 3000 }).map((p) => p.offer);
    expect(offers.map((o) => [o.id, o.lever])).toEqual([
      ["A", "cash"],
      ["B", "bundle"],
    ]);
  });

  it("ข้าม tier ที่ราคาต่ำกว่าราคาพื้น", () => {
    const risky: Product = { ...cable, volumeTiers: [{ minQty: 3000, price: 115 }] };
    const offers = buildOffers(risky, config, { requestedPrice: 125, qty: 1000 });
    expect(offers.some((p) => p.offer.lever === "volume")).toBe(false);
  });

  it("ของแถมไม่เกินจำนวนที่เหลือในสต๊อก", () => {
    // 2,900 × (145 − 135) / 50 = 580 ชิ้น แต่เหลือแค่ 500
    const bundle = buildOffers(cable, config, { requestedPrice: 125, qty: 2900 }).find(
      (p) => p.offer.lever === "bundle",
    );
    expect(bundle?.offer.bundle?.qty).toBe(500);
  });

  it("ไม่มีของค้างสต๊อก → ไม่มีข้อเสนอของแถม", () => {
    const noStock: MerchantConfig = { ...config, deadStock: [] };
    const offers = buildOffers(cable, noStock, example);
    expect(offers.some((p) => p.offer.lever === "bundle")).toBe(false);
  });

  it("ราคาของแถมปัดเป็นบาทเต็ม", () => {
    const bundle = buildOffers(cable, config, { requestedPrice: 127, qty: 1000 }).find(
      (p) => p.offer.lever === "bundle",
    );
    expect(bundle?.offer.pricePerUnit).toBe(145);
  });

  it("ไม่บอกราคา → คิดเหมือนขอที่ราคาพื้น และ baseline ใช้ราคาขาย", () => {
    const offers = buildOffers(cable, config, { requestedPrice: null, qty: 1000 });
    const bundle = offers.find((p) => p.offer.lever === "bundle");
    expect(bundle?.offer.pricePerUnit).toBe(144);
    expect(offers[0].economics.marginIfConceded).toBe(50_000);
  });
});
