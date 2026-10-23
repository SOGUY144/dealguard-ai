import { describe, expect, it } from "vitest";
import type { ChatView } from "../actions";
import { mergeServerView, selectOffer, withPendingBuyerText, withSendError } from "../live-view";
import { MOCK_OFFERS } from "../mock-offers";

const at = "2026-10-23T07:30:00.000Z";
const view: ChatView = {
  mode: "ai",
  suggestions: [{ label: "ดูสินค้าทั้งหมด", action: { type: "open_products" } }],
  messages: [{ id: "o1", at, type: "offers", sku: "CBL-C-1M", offers: MOCK_OFFERS }],
};
const offersOf = (v: ChatView) => v.messages.find((m) => m.type === "offers")!;

describe("live-view", () => {
  it("เลือกข้อเสนอในเครื่อง · การ์ดที่ยืนยันแล้วเปลี่ยนไม่ได้", () => {
    expect(offersOf(selectOffer(view, "o1", "B"))).toMatchObject({ selectedId: "B" });
    const locked: ChatView = { ...view, messages: [{ ...view.messages[0], confirmed: true, selectedId: "A" } as never] };
    expect(offersOf(selectOffer(locked, "o1", "C"))).toMatchObject({ selectedId: "A" });
  });

  it("ได้หน้าจอใหม่จาก server → ข้อที่เลือกไว้ยังอยู่ · focus จาก server ชนะ", () => {
    const picked = selectOffer(view, "o1", "C");
    expect(offersOf(mergeServerView(picked, view))).toMatchObject({ selectedId: "C" });
    expect(offersOf(mergeServerView(picked, { ...view, focus: { messageId: "o1", offerId: "A" } }))).toMatchObject({
      selectedId: "A",
    });
  });

  it("ส่งไม่สำเร็จ → เอาข้อความที่รอส่งออก แล้วเพิ่มข้อความให้ลองใหม่", () => {
    const pending = withPendingBuyerText(view, "ขอ 125", "text", at);
    expect(pending.suggestions).toEqual([]);
    expect(pending.messages.at(-1)).toMatchObject({ type: "buyer_text", text: "ขอ 125" });
    const failed = withSendError(pending, at, view.suggestions);
    expect(failed.messages.some((m) => m.type === "buyer_text")).toBe(false);
    expect(failed.messages.at(-1)).toMatchObject({ type: "ai_text" });
    // chip เดิม (เช่น "สั่ง 1,500 ชิ้น" / "จ่ายสด") กลับมา ไม่หายไปหลังส่งไม่สำเร็จ
    expect(failed.suggestions).toEqual(view.suggestions);
  });
});
