import { describe, expect, it } from "vitest";
import { assertOffersSafe } from "../guard";
import type { Offer } from "../types";
import { cable } from "./fixtures";

const base: Offer = {
  id: "A",
  lever: "volume",
  label: "ซื้อเยอะ",
  pricePerUnit: 130,
  qty: 1500,
  conditionText: "เมื่อสั่ง 1,500 ชิ้น",
  total: 195_000,
  creditDays: 30,
};

describe("assertOffersSafe", () => {
  it("ผ่านเมื่อทุกข้อเสนอไม่ต่ำกว่าราคาพื้นและมีเงื่อนไขแลก", () => {
    expect(() => assertOffersSafe(cable, 1000, [base])).not.toThrow();
  });

  it("Floor Guard: หยุดทันทีถ้ามีราคาต่ำกว่าราคาพื้น", () => {
    expect(() => assertOffersSafe(cable, 1000, [{ ...base, pricePerUnit: 119 }])).toThrow(/floor/i);
  });

  it("No Free Concession: ซื้อเยอะต้องสั่งมากกว่าที่ขอ", () => {
    expect(() => assertOffersSafe(cable, 1500, [base])).toThrow(/concession/i);
  });

  it("No Free Concession: จ่ายสดต้องเครดิต 0 วัน", () => {
    const cash: Offer = { ...base, lever: "cash", pricePerUnit: 135, qty: 1000, creditDays: 30 };
    expect(() => assertOffersSafe(cable, 1000, [cash])).toThrow(/concession/i);
  });

  it("No Free Concession: ของแถมต้องมีของแถมจริง", () => {
    const bundle: Offer = { ...base, lever: "bundle", pricePerUnit: 145, qty: 1000 };
    expect(() => assertOffersSafe(cable, 1000, [bundle])).toThrow(/concession/i);
  });

  it("ราคาปกติต้องเท่าราคาขาย", () => {
    const list: Offer = { ...base, lever: "list", pricePerUnit: 140, qty: 1000 };
    expect(() => assertOffersSafe(cable, 1000, [list])).toThrow(/concession/i);
  });
});
