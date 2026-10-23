import { describe, expect, it } from "vitest";
import { runDealEngine } from "@/lib/deal-engine/engine";
import { config, freshState, intentOf } from "@/lib/deal-engine/__tests__/fixtures";
import { MOCK_OFFERS } from "../mock-offers";

// ข้อเสนอใน mock ต้องเป็นตัวเลขเดียวกับที่ Deal Engine คิดจริง ไม่งั้นหน้าจอกับ engine จะเพี้ยนกัน
describe("MOCK_OFFERS", () => {
  it("ตรงกับผลของ Deal Engine สำหรับ ขอ ฿125 × 1,000", () => {
    const result = runDealEngine({
      config,
      intent: intentOf(),
      state: freshState,
      buyerName: "คุณนก",
      messageText: "",
    });
    if (result.kind !== "offers") throw new Error(result.kind);
    expect(MOCK_OFFERS).toEqual(result.offers.map((p) => p.offer));
  });
});
