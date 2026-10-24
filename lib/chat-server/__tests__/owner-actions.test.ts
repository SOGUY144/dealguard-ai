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
