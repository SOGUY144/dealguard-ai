// เถ้าแก่จัดการแชต (หน้า /owner/chats/[id]) — ตอบเอง / ปิดเรื่อง / ให้ AI ตอบต่อ
// เรียกจาก server หลังเช็กว่าเป็น owner แล้วเท่านั้น (เขียนด้วย service role)
import "server-only";
import { OWNER_APPROVED_LABEL } from "@/lib/chat/owner-approval";
import type { Offer } from "@/lib/chat/types";
import { computeEconomics } from "@/lib/deal-engine/margin";
import { formatBaht, formatCredit, formatQty, roundSatang } from "@/lib/format";
import type { ChatStore } from "./store";

/** ข้อความของเถ้าแก่ยาวได้มากกว่าลูกค้า (อธิบายเงื่อนไขคืนเงิน ฯลฯ) */
export const OWNER_TEXT_MAX = 1000;

export type OwnerChatAction =
  | { type: "reply"; text: string }
  /** ปิดเรื่องที่ส่งมา แต่เถ้าแก่ยังคุยต่อเอง */
  | { type: "resolve" }
  /** ให้ AI ตอบต่อ — ปิดเรื่องด้วย */
  | { type: "handback" }
  /**
   * เถ้าแก่ตัดสินแทน AI: อนุมัติราคา/จำนวน/วันจ่าย → ลูกค้าได้การ์ดข้อเสนอ 1 ข้อที่กดยืนยันเป็นออเดอร์ได้ทันที
   * ปิดเรื่องที่ส่งมา และให้ AI ดูแลแชตต่อ (ไม่งั้นลูกค้ากดยืนยันไม่ได้ — โหมด human ยืนยันข้อเสนอไม่ได้)
   */
  | { type: "approve_price"; sku: string; pricePerUnit: number; qty: number; creditDays: number };

/** วันเครดิตที่เถ้าแก่ตั้งได้ (ไม่เกิน 180 วัน) */
export const OWNER_MAX_CREDIT_DAYS = 180;

export async function ownerAction(store: ChatStore, chatId: string, action: OwnerChatAction): Promise<void> {
  const chat = await store.getChat(chatId);
  if (!chat) throw new Error("chat_not_found");

  switch (action.type) {
    case "reply": {
      const text = action.text.trim().slice(0, OWNER_TEXT_MAX);
      if (!text) return;
      await store.appendMessages(chatId, [{ type: "owner_text", text }]);
      // เถ้าแก่เข้ามาคุยเอง → AI หยุดตอบ ไม่งั้นลูกค้าได้คำตอบสองเสียง
      if (chat.mode === "ai") await store.setMode(chatId, "human");
      return;
    }
    case "resolve":
      await store.resolveEscalations(chatId);
      return;
    case "approve_price":
      await approvePrice(store, chatId, chat.mode, action);
      return;
    case "handback":
      await store.resolveEscalations(chatId);
      // เริ่มนับ "ขอต่ำกว่าพื้น / หลอกระบบ" ใหม่ — ไม่งั้นขอต่ำครั้งเดียวก็ถูกส่งเรื่องกลับมาทันที
      if (chat.negotiation.belowFloorCount > 0 || chat.negotiation.injectionCount > 0) {
        await store.setNegotiation(chatId, chat.negotiation, { belowFloorCount: 0, injectionCount: 0 });
      }
      if (chat.mode === "human") {
        await store.setMode(chatId, "ai");
        await store.appendMessages(chatId, [{ type: "system", kind: "ai_resumed" }]);
      }
      return;
  }
}

async function approvePrice(
  store: ChatStore,
  chatId: string,
  mode: "ai" | "human",
  action: Extract<OwnerChatAction, { type: "approve_price" }>,
): Promise<void> {
  const config = await store.loadConfig();
  const product = config.products.find((p) => p.sku === action.sku);
  if (!product) throw new Error("product_not_found");

  const pricePerUnit = roundSatang(action.pricePerUnit);
  const { qty, creditDays } = action;
  if (!(pricePerUnit > 0) || !Number.isInteger(qty) || qty <= 0) throw new Error("invalid_terms");
  if (!Number.isInteger(creditDays) || creditDays < 0 || creditDays > OWNER_MAX_CREDIT_DAYS) throw new Error("invalid_terms");

  const offer: Offer = {
    id: "A",
    lever: "list",
    label: OWNER_APPROVED_LABEL,
    pricePerUnit,
    qty,
    conditionText: `${formatQty(qty)} ชิ้น · ${formatCredit(creditDays)}`,
    total: roundSatang(pricePerUnit * qty),
    creditDays,
  };
  // เถ้าแก่ตัดสินเอง → baseline คือราคาที่อนุมัติ (ไม่นับเป็น "กำไรที่ AI รักษาไว้")
  const economics = computeEconomics(product, config, { referencePrice: pricePerUnit, qty }, offer);

  const added = await store.appendMessages(chatId, [
    {
      type: "owner_text",
      text: `${config.ownerDisplayName}อนุมัติราคา ${formatBaht(pricePerUnit)} × ${formatQty(qty)} ชิ้น (${formatCredit(creditDays)}) ให้แล้วครับ กดยืนยันในการ์ดด้านล่างได้เลย`,
    },
    { type: "offers", sku: product.sku, offers: [offer] },
  ]);
  const card = added.find((m) => m.type === "offers");
  if (!card) throw new Error("offer_card_missing");
  try {
    await store.saveOffers(chatId, card.id, product.sku, [{ offer, economics }]);
  } catch (err) {
    // ไม่มีแถวข้อเสนอ = กดยืนยันไม่ได้ → ถอนข้อความออก ให้เถ้าแก่กดใหม่
    await store.deleteMessages(chatId, added.map((m) => m.id));
    throw err;
  }
  await store.resolveEscalations(chatId);
  if (mode === "human") await store.setMode(chatId, "ai");
}
