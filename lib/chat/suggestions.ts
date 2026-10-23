// chip คำตอบด่วน คำนวณจากข้อความในแชต — โหลดหน้าใหม่ก็ได้ chip เดิม ไม่ต้องเก็บแยกในฐานข้อมูล
import { formatQty } from "@/lib/format";
import type { Suggestion } from "./actions";
import type { ChatMessage, ChatMessageOf } from "./types";

export function deriveSuggestions(messages: ChatMessage[], mode: "ai" | "human"): Suggestion[] {
  if (mode === "human") return [];

  const last = messages.at(-1);
  if (last?.type === "order_summary") return [{ label: "ต่อราคาสินค้าอื่น", action: { type: "open_products" } }];

  const lastAiText = [...messages].reverse().find((m) => m.type === "ai_text");
  if (lastAiText?.type === "ai_text" && lastAiText.suggest === "trade_offs") return tradeOffChips(lastOffers(messages));

  const started = messages.some((m) => m.type === "product_card" || m.type === "offers" || m.type === "buyer_text");
  return started ? [] : [{ label: "ดูสินค้าทั้งหมด", action: { type: "open_products" } }];
}

export function lastOffers(messages: ChatMessage[]): ChatMessageOf<"offers"> | undefined {
  const m = [...messages].reverse().find((x) => x.type === "offers");
  return m?.type === "offers" ? m : undefined;
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
