import { describe, expect, it, vi } from "vitest";
import { MOCK_OFFERS } from "@/lib/chat/mock-offers";
import { writeOffersText, type ReplyWriter } from "../responder";
import type { ReplyDraft, ReplyFacts } from "../validator";

const facts: ReplyFacts = {
  buyerName: "คุณนก",
  ownerName: "เฮียชัย",
  product: { sku: "CBL-C-1M", name: "สายชาร์จ Type-C 1 เมตร", listPrice: 150 },
  requestedPrice: 125,
  qty: 1000,
  competitorPrice: null,
  offers: MOCK_OFFERS,
};
const TEMPLATE = "สวัสดีครับคุณนก ราคา 125 ที่ 1,000 ชิ้นเฮียชัยให้ไม่ไหว แต่มี 3 ทางให้เลือกครับ";
const GOOD: ReplyDraft = {
  intro: "คุณนกครับ 125 เฮียชัยให้ไม่ไหว แต่มี 3 ทางครับ",
  options: [
    { id: "A", text: "ซื้อ 1,500 ชิ้นได้ ฿130" },
    { id: "B", text: "จ่ายสดได้ ฿135" },
    { id: "C", text: "฿145 แถมหัวชาร์จ 20W" },
  ],
  closing: "สนใจทางไหนครับ",
};
const GOOD_TEXT = "คุณนกครับ 125 เฮียชัยให้ไม่ไหว แต่มี 3 ทางครับ ข้อ A ซื้อ 1,500 ชิ้นได้ ฿130 · ข้อ B จ่ายสดได้ ฿135 · ข้อ C ฿145 แถมหัวชาร์จ 20W สนใจทางไหนครับ";

const writer = (impl: ReplyWriter["write"]): ReplyWriter => ({ write: vi.fn(impl) });
const withOption = (id: string, text: string): ReplyDraft => ({
  ...GOOD,
  options: GOOD.options.map((o) => (o.id === id ? { ...o, text } : o)),
});

describe("writeOffersText — LLM เรียบเรียง ตัวเลขผิดต้องไม่ถึงลูกค้า", () => {
  it("ผ่านการตรวจ → ข้อความของ LLM (ระบบต่อส่วนต่างๆ เอง)", async () => {
    const w = writer(async () => GOOD);
    expect(await writeOffersText(w, facts, TEMPLATE)).toEqual({
      text: GOOD_TEXT,
      // ตอบเป็นเสียง: พูดแค่ประโยคเปิด รายละเอียดอยู่ในการ์ดแล้ว (อ่านครบ 3 ข้อยาว ~25 วินาที)
      spoken: "คุณนกครับ 125 เฮียชัยให้ไม่ไหว แต่มี 3 ทางครับ ดูรายละเอียดแล้วกดเลือกในการ์ดได้เลยครับ",
      source: "llm",
    });
    expect(w.write).toHaveBeenCalledWith(facts);
  });

  it("LLM แต่งราคาเอง → ใช้ template", async () => {
    const w = writer(async () => withOption("B", "จ่ายสดได้ ฿129"));
    expect(await writeOffersText(w, facts, TEMPLATE)).toEqual({ text: TEMPLATE, source: "template", reason: "number:B:129" });
  });

  it("LLM สัญญาส่งฟรี → ใช้ template", async () => {
    const w = writer(async () => withOption("A", "ซื้อ 1,500 ชิ้น ส่งฟรี"));
    expect(await writeOffersText(w, facts, TEMPLATE)).toEqual({ text: TEMPLATE, source: "template", reason: "forbidden" });
  });

  it("LLM ล่ม → ใช้ template", async () => {
    const w = writer(async () => {
      throw new Error("503");
    });
    expect(await writeOffersText(w, facts, TEMPLATE)).toEqual({ text: TEMPLATE, source: "template", reason: "error" });
  });

  it("LLM ช้าเกิน → ใช้ template ไม่รอ", async () => {
    const w = writer(() => new Promise<ReplyDraft>(() => {}));
    expect(await writeOffersText(w, facts, TEMPLATE, { timeoutMs: 20 })).toEqual({
      text: TEMPLATE,
      source: "template",
      reason: "timeout",
    });
  });

  it("ไม่มีคีย์ → template โดยไม่เรียกอะไร", async () => {
    expect(await writeOffersText(null, facts, TEMPLATE)).toEqual({ text: TEMPLATE, source: "template" });
  });
});
