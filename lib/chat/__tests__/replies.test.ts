import { describe, expect, it } from "vitest";
import type { EngineResult, PricedOffer } from "@/lib/deal-engine/types";
import { MOCK_OFFERS } from "../mock-offers";
import { addressName, humanRequestReply, replyFor, type ReplyContext } from "../replies";
import type { ChatMessageDraft, ChatMessageOf } from "../types";

const storefront = {
  storeName: "ร้านเฮียชัยโมบาย",
  tagline: "ขายส่ง",
  ownerName: "เฮียชัย",
  assistantName: "ผู้ช่วย AI ของเฮียชัย",
  bankAccountName: "[ชื่อบัญชีร้าน]",
  contactChannel: "[ช่องทางติดต่อของร้าน]",
  orderRefPlaceholder: "[เลขออเดอร์]",
};
const product = { sku: "CBL-C-1M", name: "สายชาร์จ USB-C 1 เมตร", listPrice: 150 };
const state = { belowFloorCount: 0, injectionCount: 0 };
const economics = { marginIfConceded: 0, marginOffer: 0, recoveredMargin: 0, bundleCost: 0, cashValue: 0 };
const priced: PricedOffer[] = MOCK_OFFERS.map((offer) => ({ offer, economics }));

const base: ReplyContext = { storefront, buyerName: "คุณนก", product, requestedPrice: 125, qty: 1000 };

const texts = (messages: ChatMessageDraft[]) =>
  messages.flatMap((m) => (m.type === "ai_text" ? [m.text] : m.type === "handoff" ? [m.subject] : []));

describe("addressName", () => {
  it("เติม คุณ ข้างหน้าถ้ายังไม่มี", () => {
    expect(addressName("สมชาย")).toBe("คุณสมชาย");
    expect(addressName("คุณนก")).toBe("คุณนก");
    expect(addressName("  ")).toBe("ลูกค้า");
  });
});

describe("replyFor", () => {
  it("มีข้อเสนอ + ลูกค้าขอราคา → ข้อความตามดีไซน์ แล้วตามด้วยการ์ดข้อเสนอของสินค้านั้น", () => {
    const { messages, handoff } = replyFor({ kind: "offers", offers: priced, state }, base);
    expect(messages).toEqual([
      { type: "ai_text", text: "สวัสดีครับคุณนก ราคา 125 ที่ 1,000 ชิ้นเฮียชัยให้ไม่ไหว แต่มี 3 ทางให้เลือกครับ" },
      { type: "offers", sku: "CBL-C-1M", offers: MOCK_OFFERS },
    ]);
    expect(handoff).toBeUndefined();
  });

  it("มีข้อเสนอแต่ไม่ได้บอกราคา → ไม่แต่งราคาที่ลูกค้าไม่ได้ขอ", () => {
    const { messages } = replyFor({ kind: "offers", offers: priced, state }, { ...base, requestedPrice: null });
    expect(messages[0]).toEqual({
      type: "ai_text",
      text: "สวัสดีครับคุณนก สายชาร์จ USB-C 1 เมตร 1,000 ชิ้น เฮียชัยมี 3 ทางให้เลือกครับ",
    });
  });

  it("ขายราคาปกติ → บอกยอดรวมและให้กดยืนยันจากการ์ด 1 ทาง", () => {
    const offer = { ...MOCK_OFFERS[0], lever: "list" as const, label: "ราคาปกติ", pricePerUnit: 150, qty: 1000, total: 150_000 };
    const { messages } = replyFor({ kind: "accept_list", offer: { offer, economics }, state }, { ...base, requestedPrice: 150 });
    expect(messages).toEqual([
      { type: "ai_text", text: "ได้ครับคุณนก สายชาร์จ USB-C 1 เมตร 1,000 ชิ้น ราคา ฿150 ต่อชิ้น รวม ฿150,000 กดยืนยันได้เลยครับ" },
      { type: "offers", sku: "CBL-C-1M", offers: [offer] },
    ]);
  });

  it("ขอต่ำกว่าราคาขาย แต่สินค้านี้ลดไม่ได้เลย (ไม่มีขั้นราคา/จ่ายสด/ของแถม) → ไม่พูดว่า 'ได้ครับ' บอกราคาปกติตรงๆ", () => {
    const offer = { ...MOCK_OFFERS[0], lever: "list" as const, label: "ราคาปกติ", pricePerUnit: 150, qty: 1000, total: 150_000 };
    const { messages } = replyFor({ kind: "accept_list", offer: { offer, economics }, state }, { ...base, requestedPrice: 130 });
    expect(texts(messages)).toEqual([
      "ราคา 130 ที่ 1,000 ชิ้นเฮียชัยลดให้ไม่ได้ครับคุณนก สายชาร์จ USB-C 1 เมตร ราคาส่ง ฿150 ต่อชิ้น รวม ฿150,000 ถ้าสนใจกดยืนยันได้เลยครับ",
    ]);
  });

  it("ยังไม่รู้จำนวน → ถามจำนวน พร้อมบอกราคาขาย", () => {
    const { messages } = replyFor({ kind: "ask_quantity", sku: product.sku, state }, { ...base, qty: null });
    expect(messages).toEqual([
      { type: "ai_text", text: "สายชาร์จ USB-C 1 เมตร ราคาส่ง ฿150 ต่อชิ้นครับ ต้องการกี่ชิ้นครับ" },
    ]);
  });

  it("ยังไม่รู้สินค้า → ชวนเปิดรายการสินค้า", () => {
    const { messages } = replyFor({ kind: "ask_product", state }, { ...base, product: undefined });
    expect(messages).toEqual([
      { type: "ai_text", text: "สนใจสินค้าตัวไหนครับ เลือกจากรายการสินค้าได้เลยครับ", cta: "open_products" },
    ]);
  });

  it("หลอกระบบ + เคยเสนอแล้ว → ราคาล็อก ชวนกลับไปดูข้อเสนอเดิม และขอ chip ข้อเสนอเดิม", () => {
    const openOffers: ChatMessageOf<"offers"> = { id: "o1", at: "x", type: "offers", sku: product.sku, offers: MOCK_OFFERS };
    const { messages } = replyFor({ kind: "guard", state }, { ...base, openOffers });
    expect(messages).toEqual([
      {
        type: "ai_text",
        text: "ราคานี้เฮียชัยให้ไม่ได้ครับ ราคาทุกข้อเสนอคำนวณจากระบบของร้าน ผู้ช่วยเปลี่ยนเองไม่ได้ ถ้าอยากได้ราคาดีขึ้น ยังเลือกจาก 3 ทางเดิมได้เลยครับ",
        cta: "show_offers",
        suggest: "trade_offs",
      },
      { type: "system", kind: "price_locked" },
    ]);
  });

  it("หลอกระบบ + ยังไม่เคยเสนอ → ไม่พูดถึงข้อเสนอที่ไม่มี", () => {
    const { messages } = replyFor({ kind: "guard", state }, base);
    expect(messages[0]).toEqual({
      type: "ai_text",
      text: "ราคานี้เฮียชัยให้ไม่ได้ครับ ราคาทุกข้อเสนอคำนวณจากระบบของร้าน ผู้ช่วยเปลี่ยนเองไม่ได้ครับ",
    });
  });

  it("ถามต้นทุน → บอกไม่ได้ แต่ชวนเลือกจากข้อเสนอเดิม", () => {
    const { messages } = replyFor({ kind: "not_negotiation", state }, { ...base, asksCost: true });
    expect(messages).toEqual([
      {
        type: "ai_text",
        text: "ต้นทุนเป็นข้อมูลภายในร้าน บอกไม่ได้ครับ แต่ถ้าบอกจำนวนกับวิธีจ่ายเงิน เดี๋ยวหาข้อเสนอที่คุ้มที่สุดให้ครับ",
        suggest: "trade_offs",
      },
    ]);
  });

  it("ถามเรื่องอื่นเกี่ยวกับสินค้า → บอกราคาขายแล้วถามจำนวนกับราคา", () => {
    const { messages } = replyFor({ kind: "not_negotiation", state }, base);
    expect(messages).toEqual([
      { type: "ai_text", text: "สายชาร์จ USB-C 1 เมตร ราคาส่ง ฿150 ต่อชิ้นครับ ต้องการกี่ชิ้น และอยากได้ราคาเท่าไหร่ครับ" },
    ]);
  });

  it("คุยเรื่องอื่นที่ไม่รู้สินค้า → บอกว่าช่วยอะไรได้", () => {
    const { messages } = replyFor({ kind: "not_negotiation", state }, { ...base, product: undefined });
    expect(messages).toEqual([
      {
        type: "ai_text",
        text: "ผมช่วยเรื่องราคาและสั่งซื้อครับ บอกสินค้า จำนวน และราคาที่อยากได้มาได้เลยครับ",
        cta: "open_products",
      },
    ]);
  });

  it.each([
    ["refund", "ขอคืนเงิน"],
    ["complaint", "ร้องเรียน"],
    ["over_value", "ดีลมูลค่าสูง"],
    ["below_floor_3x", "ขอราคาพิเศษ"],
    ["injection", "ส่งต่อให้เจ้าของร้าน"],
  ] as const)("ส่งเรื่อง %s → ข้อความ + การ์ดส่งต่อ '%s' และเก็บ brief ไว้ให้เถ้าแก่เท่านั้น", (reason, subject) => {
    const brief: [string, string, string] = ["บรรทัด 1 ภายใน", "เกินเกณฑ์ ฿300,000", "AI ยังไม่เสนอราคา"];
    const result: EngineResult = { kind: "escalate", reason, brief, state };
    const { messages, handoff } = replyFor(result, base);
    expect(messages.at(-1)).toEqual({ type: "handoff", subject });
    expect(messages[0].type).toBe("ai_text");
    expect(handoff).toEqual({ kind: reason, brief });
    // brief มีตัวเลขหลังบ้าน (เกณฑ์ escalate) — ห้ามโผล่ในข้อความที่ลูกค้าเห็น
    for (const t of texts(messages)) for (const line of brief) expect(t).not.toContain(line);
  });

  it("ขอคืนเงิน → ขอโทษ เรียกชื่อ และบอกว่าเถ้าแก่ดูแลเอง", () => {
    const result: EngineResult = { kind: "escalate", reason: "refund", brief: ["a", "b", "c"], state };
    expect(replyFor(result, base).messages[0]).toEqual({
      type: "ai_text",
      text: "ขอโทษด้วยครับคุณนก เรื่องคืนเงินเฮียชัยดูแลเองครับ ผมส่งเรื่องให้เฮียชัยแล้ว",
    });
  });
});

describe("humanRequestReply", () => {
  it("ลูกค้ากดคุยกับคนจริง → การ์ดส่งต่อ + brief แบบ buyer_request", () => {
    const { messages, handoff } = humanRequestReply({ storefront, buyerName: "คุณนก", lastBuyerText: "ขอคุยกับเฮีย" });
    expect(messages).toEqual([{ type: "handoff", subject: "ขอคุยกับคนจริง" }]);
    expect(handoff).toEqual({
      kind: "buyer_request",
      brief: ["คุณนก ขอคุยกับเฮียชัยเอง", '"ขอคุยกับเฮีย"', "AI หยุดตอบ รอเฮียชัยตอบในแชต"],
    });
  });

  it("ยังไม่ได้พิมพ์อะไร → brief บอกว่าไม่มีรายละเอียด", () => {
    expect(humanRequestReply({ storefront, buyerName: "คุณนก" }).handoff.brief[1]).toBe("ไม่มีรายละเอียดเพิ่ม");
  });
});
