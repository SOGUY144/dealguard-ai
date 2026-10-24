import { describe, expect, it } from "vitest";
import type { ChatMessage, Offer } from "@/lib/chat/types";
import { approvalDefaults, approvalSuggestions, type ApprovalProduct } from "../chat-view";

const at = "2026-10-25T01:00:00.000Z";
const products: ApprovalProduct[] = [{ sku: "CBL-C-1M", name: "สายชาร์จ", listPrice: 150, unitCost: 100, floorPrice: 120 }];
const offer = (id: Offer["id"], lever: Offer["lever"], qty: number): Offer => ({
  id,
  lever,
  label: lever,
  pricePerUnit: 130,
  qty,
  conditionText: "",
  total: 130 * qty,
  creditDays: 0,
});
const card = (n: number, offers: Offer[]): ChatMessage => ({ id: `card-${n}`, at, type: "offers", sku: "CBL-C-1M", offers });

describe("approvalDefaults — ค่าเริ่มต้นของฟอร์มอนุมัติราคา", () => {
  it("จำนวนที่ลูกค้าขอ = จำนวนของข้อที่ไม่ใช่ 'ซื้อเยอะ'", () => {
    const messages = [card(1, [offer("A", "volume", 1500), offer("B", "cash", 1000)])];
    expect(approvalDefaults(messages, products)).toEqual({ sku: "CBL-C-1M", qty: 1000 });
  });

  it("ลูกค้าไม่เอาข้ออื่นจนการ์ดล่าสุดเหลือแค่ 'ซื้อเยอะ' → ยังได้จำนวนที่ลูกค้าขอจากการ์ดก่อนหน้า ไม่ใช่ 1,500", () => {
    const messages = [
      card(1, [offer("A", "volume", 1500), offer("B", "cash", 1000), offer("C", "bundle", 1000)]),
      card(2, [offer("A", "volume", 1500), offer("B", "cash", 1000)]),
      card(3, [offer("A", "volume", 1500)]),
    ];
    expect(approvalDefaults(messages, products)).toEqual({ sku: "CBL-C-1M", qty: 1000 });
  });

  it("ไม่มีการ์ดไหนบอกจำนวนที่ขอ (มีแต่ 'ซื้อเยอะ') → เว้นว่างให้เถ้าแก่กรอกเอง ไม่เดา", () => {
    expect(approvalDefaults([card(1, [offer("A", "volume", 1500)])], products)).toEqual({ sku: "CBL-C-1M", qty: null });
  });
});

describe("approvalSuggestions — chip ราคาแนะนำในฟอร์มอนุมัติ", () => {
  const items: ApprovalProduct[] = [
    { sku: "CBL-C-1M", name: "สายชาร์จ Type-C 1 เมตร", listPrice: 180, unitCost: 100, floorPrice: 120 },
    { sku: "CBL-L-1M", name: "สาย Lightning 1 เมตร", listPrice: 200, unitCost: 110, floorPrice: 140 },
  ];
  let n = 0;
  const buyer = (text: string): ChatMessage => ({ id: `b${++n}`, at, type: "buyer_text", text, inputMode: "text" });
  const shown = (sku: string): ChatMessage => {
    const p = items.find((x) => x.sku === sku)!;
    return { id: `p${++n}`, at, type: "product_card", sku, name: p.name, listPrice: p.listPrice };
  };
  const deal = (sku: string, offers: Offer[]): ChatMessage => ({ id: `o${++n}`, at, type: "offers", sku, offers });
  const priced = (id: Offer["id"], lever: Offer["lever"], label: string, pricePerUnit: number, qty: number, creditDays: number): Offer => ({
    id,
    lever,
    label,
    pricePerUnit,
    qty,
    conditionText: "",
    total: pricePerUnit * qty,
    creditDays,
  });

  it("ลูกค้าขอ ฿150 → chip แรกเติมราคาที่ขอ · ปิดท้ายด้วยราคาปกติ", () => {
    const messages = [shown("CBL-C-1M"), buyer("ขอ 150 ได้ไหม 1000 ชิ้น")];
    expect(approvalSuggestions(messages, items, "CBL-C-1M")).toEqual([
      { label: "ลูกค้าขอ ฿150", pricePerUnit: 150 },
      { label: "ราคาปกติ ฿180", pricePerUnit: 180 },
    ]);
  });

  it("การ์ดข้อเสนอล่าสุด → chip ละข้อ เติมราคา จำนวน วันจ่าย · chip ที่ลูกค้าขอได้จำนวนที่ลูกค้าขอ (ไม่ใช่ 1,500)", () => {
    const messages = [
      shown("CBL-C-1M"),
      buyer("ขอ 150 ได้ไหม 1000 ชิ้น"),
      deal("CBL-C-1M", [priced("A", "volume", "ซื้อเยอะ", 160, 1500, 45), priced("B", "cash", "จ่ายสด", 165, 1000, 0)]),
    ];
    expect(approvalSuggestions(messages, items, "CBL-C-1M")).toEqual([
      { label: "ลูกค้าขอ ฿150", pricePerUnit: 150, qty: 1000 },
      { label: "A ซื้อเยอะ ฿160 × 1,500", pricePerUnit: 160, qty: 1500, creditDays: 45 },
      { label: "B จ่ายสด ฿165 × 1,000", pricePerUnit: 165, qty: 1000, creditDays: 0 },
      { label: "ราคาปกติ ฿180", pricePerUnit: 180 },
    ]);
  });

  it("ราคาซ้ำกัน → เหลือ chip แรก", () => {
    const messages = [
      shown("CBL-C-1M"),
      buyer("ขอ 160 ได้ไหม 1000 ชิ้น"),
      deal("CBL-C-1M", [priced("A", "volume", "ซื้อเยอะ", 160, 1500, 30), priced("B", "list", "ราคาปกติ", 180, 1000, 30)]),
    ];
    expect(approvalSuggestions(messages, items, "CBL-C-1M").map((s) => s.label)).toEqual([
      "ลูกค้าขอ ฿160",
      "B ราคาปกติ ฿180 × 1,000",
    ]);
  });

  it("แยกตามสินค้า — ราคาที่ขอและการ์ดข้อเสนอของสินค้าอื่นไม่ปนมา", () => {
    const messages = [
      shown("CBL-C-1M"),
      buyer("ขอ 150 ได้ไหม 1000 ชิ้น"),
      deal("CBL-C-1M", [priced("A", "volume", "ซื้อเยอะ", 160, 1500, 30)]),
      shown("CBL-L-1M"),
      buyer("ขอ 170 ได้ไหม 500 ชิ้น"),
      deal("CBL-L-1M", [priced("A", "volume", "ซื้อเยอะ", 185, 800, 30)]),
    ];
    expect(approvalSuggestions(messages, items, "CBL-C-1M").map((s) => s.label)).toEqual([
      "ลูกค้าขอ ฿150",
      "A ซื้อเยอะ ฿160 × 1,500",
      "ราคาปกติ ฿180",
    ]);
    expect(approvalSuggestions(messages, items, "CBL-L-1M").map((s) => s.label)).toEqual([
      "ลูกค้าขอ ฿170",
      "A ซื้อเยอะ ฿185 × 800",
      "ราคาปกติ ฿200",
    ]);
  });

  it("ลูกค้าพิมพ์ชื่อสินค้ามาเอง → นับเป็นราคาที่ขอของสินค้านั้น แม้การ์ดล่าสุดเป็นสินค้าอื่น", () => {
    const messages = [shown("CBL-C-1M"), buyer("สาย Lightning 1 เมตร ขอ 170 ได้ไหม")];
    expect(approvalSuggestions(messages, items, "CBL-L-1M")[0]).toEqual({ label: "ลูกค้าขอ ฿170", pricePerUnit: 170 });
    expect(approvalSuggestions(messages, items, "CBL-C-1M").map((s) => s.label)).toEqual(["ราคาปกติ ฿180"]);
  });

  it("ขอราคาก่อนมีการ์ดใดๆ (ยังไม่รู้ว่าสินค้าไหน) → ยังนับ ไม่ทิ้ง", () => {
    const messages = [buyer("ขอ 150 ได้ไหม 1000 ชิ้น"), deal("CBL-C-1M", [priced("A", "volume", "ซื้อเยอะ", 160, 1500, 30)])];
    expect(approvalSuggestions(messages, items, "CBL-C-1M")[0]).toEqual({ label: "ลูกค้าขอ ฿150", pricePerUnit: 150 });
  });
});
