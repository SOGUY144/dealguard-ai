// chip คำตอบด่วน คำนวณจากข้อความในแชต — โหลดหน้าใหม่ก็ได้ chip เดิม ไม่ต้องเก็บแยกในฐานข้อมูล
import { fallbackIntent } from "@/lib/ai/fallback-intent";
import { formatQty } from "@/lib/format";
import type { Suggestion } from "./actions";
import type { ChatMessage, ChatMessageOf, PublicProduct } from "./types";

/** การ์ดข้อเสนอที่เก่ากว่านี้ยืนยันไม่ได้ (ราคา/สต๊อกอาจเปลี่ยนแล้ว) — ไม่ชวนให้เลือกอีก */
export const OFFER_TTL_MS = 24 * 60 * 60 * 1000;

export function isOfferCardExpired(offers: ChatMessageOf<"offers">, now: Date): boolean {
  return now.getTime() - Date.parse(offers.at) > OFFER_TTL_MS;
}

export function deriveSuggestions(messages: ChatMessage[], mode: "ai" | "human", now = new Date()): Suggestion[] {
  if (mode === "human") return [];

  const last = messages.at(-1);
  if (last?.type === "order_summary") return [{ label: "ต่อราคาสินค้าอื่น", action: { type: "open_products" } }];

  const lastAiText = [...messages].reverse().find((m) => m.type === "ai_text");
  if (lastAiText?.type === "ai_text" && lastAiText.suggest === "trade_offs") {
    const offers = lastOffers(messages);
    return offers && !isOfferCardExpired(offers, now) ? tradeOffChips(offers) : [];
  }

  const started = messages.some((m) => m.type === "product_card" || m.type === "offers" || m.type === "buyer_text");
  return started ? [] : [{ label: "ดูสินค้าทั้งหมด", action: { type: "open_products" } }];
}

export function lastOffers(messages: ChatMessage[]): ChatMessageOf<"offers"> | undefined {
  const m = [...messages].reverse().find((x) => x.type === "offers");
  return m?.type === "offers" ? m : undefined;
}

/** ข้อความหลังออเดอร์ล่าสุด (ต่อรองรอบใหม่หลังสั่งของ = เริ่มนับใหม่) */
export function sinceLastOrder(messages: ChatMessage[]): ChatMessage[] {
  return messages.slice(messages.findLastIndex((m) => m.type === "order_summary") + 1);
}

/** ราคาต่อชิ้นล่าสุดที่ลูกค้าขอในรอบต่อรองนี้ — "ไม่ซื้อเพิ่ม" ไม่ได้แปลว่าเลิกขอราคานั้น */
export function lastAskedPrice(messages: ChatMessage[], products: PublicProduct[], sku: string): number | null {
  for (const m of sinceLastOrder(messages).reverse()) {
    if (m.type !== "buyer_text") continue;
    const price = fallbackIntent(m.text, { products, lastSku: sku }).requestedPrice;
    if (price !== null) return price;
  }
  return null;
}

/** chip ที่เลือกข้อเสนอเดิม (ซื้อเยอะ / จ่ายสด) — ไม่มีข้อเสนอหรือยืนยันไปแล้วก็ไม่มี chip */
export function tradeOffChips(offers: ChatMessageOf<"offers"> | undefined): Suggestion[] {
  if (!offers || offers.confirmed) return [];
  const chips: Suggestion[] = [];
  for (const o of offers.offers) {
    const label = o.lever === "volume" ? `สั่ง ${formatQty(o.qty)} ชิ้น` : o.lever === "cash" ? "จ่ายสด" : null;
    if (label) chips.push({ label, action: { type: "select_offer", messageId: offers.id, offerId: o.id } });
  }
  return chips;
}
