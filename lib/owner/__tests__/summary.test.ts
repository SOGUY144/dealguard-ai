import { describe, expect, it } from "vitest";
import { MOCK_OFFERS } from "@/lib/chat/mock-offers";
import {
  activeChatStatus,
  bangkokDayStart,
  chatPreview,
  chartMax,
  dealRangeStart,
  groupDealsByDay,
  parseDealRange,
  escalationLabel,
  ownerInitials,
  summarize,
  thaiDate,
  type OwnerDeal,
} from "../summary";

// ตัวเลขตัวอย่างจาก SKILL §6.5 (ขอ ฿125 × 1,000 → ยอมลดได้กำไร ฿25,000)
const deal = (letter: 0 | 1 | 2, marginOffer: number, at: string): OwnerDeal => ({
  id: `o${letter}`,
  at,
  buyerName: "คุณนก",
  productName: "สายชาร์จ Type-C 1 เมตร",
  offer: MOCK_OFFERS[letter],
  marginIfConceded: 25_000,
  marginOffer,
  recoveredMargin: marginOffer - 25_000,
});

describe("summarize", () => {
  it("รวมกำไรที่รักษาไว้ ยอดขาย และจำนวนดีล (ตัวอย่างใน SKILL)", () => {
    const deals = [
      deal(0, 45_000, "2026-10-24T03:00:00Z"),
      deal(1, 36_332, "2026-10-24T04:00:00Z"),
      deal(2, 42_000, "2026-10-24T05:00:00Z"),
    ];
    expect(summarize(deals)).toEqual({ recoveredTotal: 48_332, revenueTotal: 475_000, dealCount: 3 });
  });

  it("ยังไม่มีดีล → ศูนย์ทั้งหมด", () => {
    expect(summarize([])).toEqual({ recoveredTotal: 0, revenueTotal: 0, dealCount: 0 });
  });
});

describe("bangkokDayStart", () => {
  it("เที่ยงคืนเวลาไทย = 17:00 UTC ของวันก่อน", () => {
    expect(bangkokDayStart(new Date("2026-10-24T10:00:00Z")).toISOString()).toBe("2026-10-23T17:00:00.000Z");
  });

  it("ตีหนึ่งเวลาไทย (18:00 UTC) ยังเป็นวันใหม่ของไทย", () => {
    expect(bangkokDayStart(new Date("2026-10-23T18:00:00Z")).toISOString()).toBe("2026-10-23T17:00:00.000Z");
  });

  it("ห้าทุ่มเวลาไทย (16:00 UTC) ยังเป็นวันเดิม", () => {
    expect(bangkokDayStart(new Date("2026-10-23T16:00:00Z")).toISOString()).toBe("2026-10-22T17:00:00.000Z");
  });
});

describe("chartMax", () => {
  it("ปัดขึ้นเป็นหลักหมื่นถัดไป ให้แท่งสูงสุดไม่ชนขอบ", () => {
    expect(chartMax([25_000, 45_000, 36_332])).toBe(50_000);
    expect(chartMax([50_000])).toBe(60_000);
  });

  it("ค่าน้อยหรือไม่มีค่า → อย่างน้อย 10,000", () => {
    expect(chartMax([])).toBe(10_000);
    expect(chartMax([800])).toBe(10_000);
  });
});

describe("escalationLabel", () => {
  it("ชื่อประเภทเรื่องที่ส่งให้เถ้าแก่", () => {
    expect(escalationLabel("over_value")).toBe("เกินเกณฑ์มูลค่า");
    expect(escalationLabel("refund")).toBe("ขอคืนเงิน");
    expect(escalationLabel("buyer_request")).toBe("ลูกค้าขอคุยกับคน");
  });
});

describe("ownerInitials / thaiDate", () => {
  it("ตัดคำนำหน้า เฮีย/คุณ ออก", () => {
    expect(ownerInitials("เฮียชัย")).toBe("ชัย");
    expect(ownerInitials("คุณสมศักดิ์")).toBe("สมศ");
    expect(ownerInitials("กรรมการ (เถ้าแก่)")).toBe("กรร");
  });

  it("วันที่แบบไทย (พ.ศ.) ตามเวลาไทย", () => {
    expect(thaiDate(new Date("2026-10-23T18:00:00Z"))).toBe("24 ต.ค. 2569");
  });
});

describe("แชตที่กำลังคุย — สถานะ + ข้อความล่าสุด", () => {
  const at = "2026-10-24T03:00:00Z";
  it("สถานะ: เถ้าแก่ดูแล > ปิดดีลแล้ว > AI กำลังคุย", () => {
    expect(activeChatStatus("human", [{ id: "1", at, type: "buyer_text", text: "x", inputMode: "text" }])).toBe("owner");
    expect(
      activeChatStatus("ai", [{ id: "1", at, type: "order_summary", orderId: "o", offer: MOCK_OFFERS[0], productName: "x" }]),
    ).toBe("ordered");
    expect(activeChatStatus("ai", [{ id: "1", at, type: "ai_text", text: "สวัสดี" }])).toBe("ai");
  });

  it("ข้อความล่าสุดแบบสั้น (ข้ามป้ายระบบ)", () => {
    expect(chatPreview([{ id: "1", at, type: "buyer_text", text: "ขอ 125 ได้ไหม", inputMode: "text" }])).toBe("ขอ 125 ได้ไหม");
    expect(chatPreview([{ id: "1", at, type: "offers", sku: "x", offers: MOCK_OFFERS }])).toBe("AI เสนอ 3 ทาง");
    expect(chatPreview([{ id: "1", at, type: "owner_text", text: "เดี๋ยวโทรกลับ" }])).toBe("คุณ: เดี๋ยวโทรกลับ");
    expect(
      chatPreview([
        { id: "1", at, type: "order_summary", orderId: "o", offer: MOCK_OFFERS[1], productName: "x" },
        { id: "2", at, type: "system", kind: "price_locked" },
      ]),
    ).toBe("ปิดดีล ข้อ B · ฿135,000");
    expect(chatPreview([])).toBe("");
  });
});


describe("ช่วงวันของหน้าดีลทั้งหมด", () => {
  // 24 ต.ค. 2569 10:00 เวลาไทย
  const now = new Date("2026-10-24T03:00:00Z");
  it("วันนี้ / 7 วัน / 30 วัน นับรวมวันนี้ ตามเวลาไทย · ทั้งหมด = ไม่จำกัด", () => {
    expect(dealRangeStart("today", now)?.toISOString()).toBe("2026-10-23T17:00:00.000Z");
    expect(dealRangeStart("7d", now)?.toISOString()).toBe("2026-10-17T17:00:00.000Z");
    expect(dealRangeStart("30d", now)?.toISOString()).toBe("2026-09-24T17:00:00.000Z");
    expect(dealRangeStart("all", now)).toBeNull();
  });
  it("ค่าแปลกจาก URL → ทั้งหมด", () => {
    expect(parseDealRange("abc")).toBe("all");
    expect(parseDealRange(undefined)).toBe("all");
    expect(parseDealRange("7d")).toBe("7d");
    expect(parseDealRange("toString")).toBe("all");
    expect(parseDealRange("__proto__")).toBe("all");
  });
  it("จัดกลุ่มตามวัน (ใหม่ก่อน)", () => {
    const sampleDeal = deal(0, 45_000, "2026-10-24T03:00:00Z");
    const at = (id: string, when: string) => ({ ...sampleDeal, id, at: when });
    const groups = groupDealsByDay([at("a", "2026-10-23T02:00:00Z"), at("b", "2026-10-24T02:00:00Z"), at("c", "2026-10-24T05:00:00Z")]);
    expect(groups.map((g) => [g.label, g.deals.map((d) => d.id)])).toEqual([
      ["24 ต.ค. 2569", ["c", "b"]],
      ["23 ต.ค. 2569", ["a"]],
    ]);
  });
});
