import { beforeEach, describe, expect, it } from "vitest";
import merchant from "@/lib/config/merchant.json";
import type { ChatMessage } from "@/lib/chat/types";
import type { MerchantConfig } from "@/lib/deal-engine/types";
import { MemoryChatStore } from "../memory-store";
import { ownerAction } from "../owner-actions";
import { handleAction, type PipelineDeps } from "../pipeline";

const config: MerchantConfig = merchant;
const storefront = {
  storeName: "ร้านเฮียชัยโมบาย",
  tagline: "ขายส่ง",
  ownerName: "เฮียชัย",
  assistantName: "ผู้ช่วย AI ของเฮียชัย",
  bankAccountName: "[ชื่อบัญชีร้าน]",
  contactChannel: "[ช่องทางติดต่อของร้าน]",
  orderRefPlaceholder: "[เลขออเดอร์]",
};
const nok = { id: "buyer-nok", displayName: "คุณนก" };

let store: MemoryChatStore;
let deps: PipelineDeps;
let chatId: string;

const say = (text: string) => handleAction(deps, nok, { type: "send", text, inputMode: "text" });
const messages = () => store.messages.get(chatId) ?? [];
const lastOf = (type: ChatMessage["type"]) => messages().findLast((m) => m.type === type);

beforeEach(async () => {
  store = new MemoryChatStore(config);
  deps = { store, storefront, intentLlm: null };
  await handleAction(deps, nok, { type: "pick_product", sku: "CBL-C-1M" });
  await say("ของเสีย 50 ชิ้น ขอคืนเงิน");
  chatId = store.chats[0].id;
});

describe("ownerAction — เถ้าแก่ตอบเอง / ปิดเรื่อง / ให้ AI ตอบต่อ", () => {
  it("ตอบลูกค้า → ข้อความในชื่อเถ้าแก่ (owner_text) · แชตยังเป็นโหมด human", async () => {
    await ownerAction(store, chatId, { type: "reply", text: "  ขอรูปของที่เสียหน่อยครับ  " });
    expect(lastOf("owner_text")).toMatchObject({ type: "owner_text", text: "ขอรูปของที่เสียหน่อยครับ" });
    expect(store.chats[0].mode).toBe("human");
  });

  it("ตอบข้อความว่าง → ไม่บันทึก", async () => {
    const before = messages().length;
    await ownerAction(store, chatId, { type: "reply", text: "   " });
    expect(messages()).toHaveLength(before);
  });

  it("เถ้าแก่เข้ามาตอบแชตที่ AI ยังตอบอยู่ → รับช่วงต่อ (AI หยุดตอบ)", async () => {
    await ownerAction(store, chatId, { type: "handback" });
    expect(store.chats[0].mode).toBe("ai");
    await ownerAction(store, chatId, { type: "reply", text: "เฮียคุยเองนะครับ" });
    expect(store.chats[0].mode).toBe("human");
    const after = await say("ขอ 125 ได้ไหม 1000 ชิ้น");
    expect(after.messages.at(-1)).toMatchObject({ type: "buyer_text" });
  });

  it("ปิดเรื่อง → escalation เป็น resolved แต่เถ้าแก่ยังคุยต่อเอง (AI ไม่กลับมา)", async () => {
    await ownerAction(store, chatId, { type: "resolve" });
    expect(store.escalations.every((e) => e.status === "resolved")).toBe(true);
    expect(store.chats[0].mode).toBe("human");
  });

  it("ให้ AI ตอบต่อ → โหมด ai · ปิดเรื่องที่ค้าง · บอกลูกค้าว่า AI กลับมาแล้ว · AI ตอบได้อีก", async () => {
    await ownerAction(store, chatId, { type: "handback" });
    expect(store.chats[0].mode).toBe("ai");
    expect(store.escalations.every((e) => e.status === "resolved")).toBe(true);
    expect(lastOf("system")).toMatchObject({ kind: "ai_resumed" });

    const view = await say("ขอ 125 ได้ไหม 1000 ชิ้น");
    expect(view.messages.findLast((m) => m.type === "offers")).toBeDefined();
  });

  it("ให้ AI ตอบต่อทั้งที่ AI ตอบอยู่แล้ว → ไม่เพิ่มข้อความซ้ำ", async () => {
    await ownerAction(store, chatId, { type: "handback" });
    const before = messages().length;
    await ownerAction(store, chatId, { type: "handback" });
    expect(messages()).toHaveLength(before);
  });

  it("แชตที่ไม่มีอยู่ → แจ้งว่าไม่พบ", async () => {
    await expect(ownerAction(store, "nope", { type: "reply", text: "x" })).rejects.toThrow("chat_not_found");
  });
});

describe("รีวิวรอบ 3 — ให้ AI ตอบต่อแล้วเริ่มนับใหม่", () => {
  it("ส่งเรื่องเพราะขอต่ำกว่าพื้น 3 รอบ → handback → ขอต่ำอีกครั้งเดียวไม่ส่งเรื่องทันที", async () => {
    const fresh = new MemoryChatStore(config);
    const d: PipelineDeps = { store: fresh, storefront, intentLlm: null };
    const buyer = { id: "buyer-low", displayName: "คุณต่ำ" };
    const ask = (t: string) => handleAction(d, buyer, { type: "send", text: t, inputMode: "text" });
    await handleAction(d, buyer, { type: "pick_product", sku: "CBL-C-1M" });
    for (let i = 0; i < 3; i++) await ask("ขอ 100 ได้ไหม 1000 ชิ้น");
    const chat = fresh.chats[0];
    expect(chat.mode).toBe("human");

    await ownerAction(fresh, chat.id, { type: "handback" });
    expect(fresh.chats[0].negotiation).toEqual({ belowFloorCount: 0, injectionCount: 0 });
    const view = await ask("ขอ 100 ได้ไหม 1000 ชิ้น");
    expect(view.mode).toBe("ai");
  });
});

describe("ownerAction — เถ้าแก่อนุมัติราคาเอง (AI เจรจา เถ้าแก่แค่ตัดสิน)", () => {
  const approve = (over: Partial<{ sku: string; pricePerUnit: number; qty: number; creditDays: number }> = {}) =>
    ownerAction(store, chatId, { type: "approve_price", sku: "CBL-C-1M", pricePerUnit: 125, qty: 1000, creditDays: 0, ...over });

  it("ได้ข้อความในชื่อเถ้าแก่ + การ์ดข้อเสนอ 1 ข้อ · ปิดเรื่อง · AI กลับมาดูแลแชต", async () => {
    await approve();
    expect(lastOf("owner_text")).toMatchObject({ text: expect.stringContaining("อนุมัติราคา ฿125 × 1,000 ชิ้น (โอนทันที)") });
    expect(lastOf("offers")).toMatchObject({
      type: "offers",
      sku: "CBL-C-1M",
      offers: [{ id: "A", lever: "list", label: "ราคาที่เถ้าแก่อนุมัติ", pricePerUnit: 125, qty: 1000, total: 125_000, creditDays: 0 }],
    });
    expect(store.escalations.every((e) => e.status === "resolved")).toBe(true);
    expect(store.chats[0].mode).toBe("ai");
    expect(store.offers.at(-1)).toMatchObject({ sku: "CBL-C-1M" });
  });

  it("ลูกค้ากดยืนยันการ์ดที่เถ้าแก่อนุมัติ → เป็นออเดอร์ แม้ราคาต่ำกว่าพื้นหรือยอดเกินเกณฑ์ของ AI", async () => {
    await approve({ pricePerUnit: 110, qty: 5000, creditDays: 7 });
    const card = lastOf("offers");
    const view = await handleAction(deps, nok, { type: "confirm_offer", messageId: card!.id, offerId: "A" });
    expect(view.notice).toBeUndefined();
    expect(view.messages.at(-1)).toMatchObject({
      type: "order_summary",
      offer: { pricePerUnit: 110, qty: 5000, total: 550_000, creditDays: 7 },
    });
    expect(store.orders).toHaveLength(1);
  });

  it("สินค้าที่ไม่มีในร้าน / ตัวเลขผิด → ไม่บันทึกอะไร", async () => {
    const before = messages().length;
    await expect(approve({ sku: "NOPE" })).rejects.toThrow("product_not_found");
    await expect(approve({ qty: 1.5 })).rejects.toThrow("invalid_terms");
    await expect(approve({ creditDays: -1 })).rejects.toThrow("invalid_terms");
    await expect(approve({ pricePerUnit: 0 })).rejects.toThrow("invalid_terms");
    expect(messages()).toHaveLength(before);
  });

  it("บันทึกข้อเสนอไม่สำเร็จ → ถอนข้อความที่เพิ่งเพิ่ม (ไม่ทิ้งการ์ดที่ยืนยันไม่ได้)", async () => {
    const before = messages().length;
    store.saveOffers = async () => {
      throw new Error("db down");
    };
    await expect(approve()).rejects.toThrow("db down");
    expect(messages()).toHaveLength(before);
  });
});

describe("บทสนทนาเต็ม: ต่อราคา → ปฏิเสธทีละทาง → เถ้าแก่อนุมัติ → ลูกค้ายืนยัน", () => {
  it("ระบบจำสิ่งที่ปฏิเสธ ไม่วนเสนอซ้ำ · ไม่เหลือทาง → ส่งเถ้าแก่ → อนุมัติแล้วเป็นออเดอร์", async () => {
    const fresh = new MemoryChatStore(config);
    const d: PipelineDeps = { store: fresh, storefront, intentLlm: null };
    const ann = { id: "buyer-ann", displayName: "คุณแอน" };
    const talk = (text: string) => handleAction(d, ann, { type: "send", text, inputMode: "text" });
    const levers = (view: Awaited<ReturnType<typeof talk>>) =>
      view.messages.findLast((m) => m.type === "offers")?.type === "offers"
        ? (view.messages.findLast((m) => m.type === "offers") as Extract<ChatMessage, { type: "offers" }>).offers.map((o) => o.lever)
        : [];

    await handleAction(d, ann, { type: "pick_product", sku: "CBL-C-1M" });
    expect(levers(await talk("ขอ 125 ได้ไหม 1000 ชิ้น"))).toEqual(["volume", "cash", "bundle"]);
    expect(levers(await talk("ไม่ซื้อเพิ่มครับ"))).toEqual(["cash", "bundle"]);
    expect(levers(await talk("ไม่เอาของแถม"))).toEqual(["cash"]);
    const last = await talk("ไม่จ่ายสด ขอ 125 เท่านั้น");
    expect(last.mode).toBe("human");
    expect(last.messages.at(-1)).toMatchObject({ type: "handoff" });
    const esc = fresh.escalations.at(-1)!;
    expect(esc.kind).toBe("buyer_request");
    expect(esc.brief[0]).toContain("ไม่รับทุกทางเลือก");
    expect(esc.brief[2]).toContain("ถ้ายอม ฿125 ได้กำไร ฿25,000");

    const chat = fresh.chats[0].id;
    await ownerAction(fresh, chat, { type: "approve_price", sku: "CBL-C-1M", pricePerUnit: 125, qty: 1000, creditDays: 7 });
    const card = (fresh.messages.get(chat) ?? []).findLast((m) => m.type === "offers")!;
    const done = await handleAction(d, ann, { type: "confirm_offer", messageId: card.id, offerId: "A" });
    expect(done.messages.at(-1)).toMatchObject({ type: "order_summary", offer: { pricePerUnit: 125, creditDays: 7 } });
  });

  it("ปฏิเสธแล้วราคาไม่ดีขึ้นเอง: ข้อของแถมเท่าเดิม · ไม่พูดราคาซ้ำก็ยังส่งราคาที่ขอให้เถ้าแก่", async () => {
    const fresh = new MemoryChatStore(config);
    const d: PipelineDeps = { store: fresh, storefront, intentLlm: null };
    const ann = { id: "buyer-ann", displayName: "คุณแอน" };
    const talk = (text: string) => handleAction(d, ann, { type: "send", text, inputMode: "text" });
    const bundleOf = (view: Awaited<ReturnType<typeof talk>>) => {
      const card = view.messages.findLast((m) => m.type === "offers") as Extract<ChatMessage, { type: "offers" }>;
      return card.offers.find((o) => o.lever === "bundle");
    };
    await handleAction(d, ann, { type: "pick_product", sku: "CBL-C-1M" });
    const first = bundleOf(await talk("ขอ 125 ได้ไหม 1000 ชิ้น"));
    const second = await talk("ซื้อเพิ่มไม่ไหว");
    expect(bundleOf(second)).toMatchObject({ pricePerUnit: first!.pricePerUnit, bundle: first!.bundle });
    expect(second.messages.findLast((m) => m.type === "ai_text")).toMatchObject({ text: expect.stringContaining("ยังมีอีก 2 ทาง") });
    await talk("ของแถมไม่ต้อง");
    const last = await talk("จ่ายสดไม่สะดวก");
    expect(last.mode).toBe("human");
    expect(fresh.escalations.at(-1)!.brief[1]).toContain("ที่ ฿125");
  });

  it('พิมพ์ "เอาข้อ B" → ชี้ไปข้อ B ให้กดยืนยัน · "ไม่เอาข้อ A" → ตัดทางของข้อ A', async () => {
    const fresh = new MemoryChatStore(config);
    const d: PipelineDeps = { store: fresh, storefront, intentLlm: null };
    const ann = { id: "buyer-ann", displayName: "คุณแอน" };
    const talk = (text: string) => handleAction(d, ann, { type: "send", text, inputMode: "text" });
    await handleAction(d, ann, { type: "pick_product", sku: "CBL-C-1M" });
    const offered = await talk("ขอ 125 ได้ไหม 1000 ชิ้น");
    const card = offered.messages.findLast((m) => m.type === "offers")!;
    const picked = await talk("เอาข้อ B");
    expect(picked.focus).toEqual({ messageId: card.id, offerId: "B" });
    expect(picked.messages.at(-1)).toMatchObject({ type: "ai_text", text: expect.stringContaining("ข้อ B") });

    const rejected = await talk("ไม่เอาข้อ A");
    const next = rejected.messages.findLast((m) => m.type === "offers") as Extract<ChatMessage, { type: "offers" }>;
    expect(next.offers.map((o) => o.lever)).toEqual(["cash", "bundle"]);
  });
});
