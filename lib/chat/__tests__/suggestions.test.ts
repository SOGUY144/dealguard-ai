import { describe, expect, it } from "vitest";
import { MOCK_OFFERS } from "../mock-offers";
import { deriveSuggestions } from "../suggestions";
import type { ChatMessage } from "../types";

const at = "2026-10-23T14:30:00Z";
const greeting: ChatMessage = { id: "g", at, type: "ai_text", text: "สวัสดีครับ", cta: "open_products" };
const card: ChatMessage = { id: "p", at, type: "product_card", sku: "CBL-C-1M", name: "สายชาร์จ", listPrice: 150 };
const offers: ChatMessage = { id: "o", at, type: "offers", sku: "CBL-C-1M", offers: MOCK_OFFERS };

// chip คำนวณจากข้อความในแชต — โหลดหน้าใหม่ก็ได้ chip เดิม ไม่ต้องเก็บแยก
describe("deriveSuggestions", () => {
  it("แชตใหม่ → ดูสินค้าทั้งหมด", () => {
    expect(deriveSuggestions([greeting], "ai")).toEqual([{ label: "ดูสินค้าทั้งหมด", action: { type: "open_products" } }]);
  });

  it("เลือกสินค้าแล้ว → ไม่มี chip (ให้ลูกค้าพิมพ์เอง)", () => {
    expect(deriveSuggestions([greeting, card], "ai")).toEqual([]);
  });

  it("ข้อความที่ขอ chip ข้อเสนอเดิม → สั่ง 1,500 ชิ้น / จ่ายสด ที่ชี้ไปข้อเสนอล่าสุด", () => {
    const guard: ChatMessage = { id: "x", at, type: "ai_text", text: "ราคาล็อก", suggest: "trade_offs" };
    // การ์ดข้อเสนออายุ 24 ชม. — ใช้เวลาคงที่ ไม่งั้น test พังเองเมื่อวันผ่านไป
    expect(deriveSuggestions([greeting, card, offers, guard], "ai", new Date("2026-10-23T15:00:00Z"))).toEqual([
      { label: "สั่ง 1,500 ชิ้น", action: { type: "select_offer", messageId: "o", offerId: "A" } },
      { label: "จ่ายสด", action: { type: "select_offer", messageId: "o", offerId: "B" } },
    ]);
  });

  it("ขอ chip ข้อเสนอเดิมแต่ยังไม่เคยเสนอ หรือยืนยันไปแล้ว → ไม่มี chip", () => {
    const guard: ChatMessage = { id: "x", at, type: "ai_text", text: "ราคาล็อก", suggest: "trade_offs" };
    expect(deriveSuggestions([greeting, card, guard], "ai")).toEqual([]);
    expect(deriveSuggestions([greeting, { ...offers, confirmed: true }, guard], "ai")).toEqual([]);
  });

  it("ยืนยันออเดอร์แล้ว → ต่อราคาสินค้าอื่น", () => {
    const summary: ChatMessage = { id: "s", at, type: "order_summary", orderId: "1", offer: MOCK_OFFERS[0], productName: "x" };
    expect(deriveSuggestions([greeting, card, offers, summary], "ai")).toEqual([
      { label: "ต่อราคาสินค้าอื่น", action: { type: "open_products" } },
    ]);
  });

  it("ส่งเรื่องให้เถ้าแก่แล้ว → ไม่มี chip", () => {
    expect(deriveSuggestions([greeting], "human")).toEqual([]);
  });
});
