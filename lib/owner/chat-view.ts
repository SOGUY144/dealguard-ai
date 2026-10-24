// สิ่งที่หน้าแชตเถ้าแก่ (/owner/chats/[id]) ใช้วาด — ไม่มีตัวเลขหลังบ้าน (ต้นทุน/margin) อยู่ในนี้
import { fallbackIntent } from "@/lib/ai/fallback-intent";
import type { HandoffKind } from "@/lib/chat/replies";
import { lastAskedPrice, lastOffers, sinceLastOrder } from "@/lib/chat/suggestions";
import type { ChatMessage } from "@/lib/chat/types";
import { formatBaht, formatQty } from "@/lib/format";

export type OwnerChatView = {
  chatId: string;
  /** human = AI หยุดตอบ เถ้าแก่คุยเอง */
  mode: "ai" | "human";
  buyerName: string;
  messages: ChatMessage[];
  /** เรื่องล่าสุดที่ส่งให้เถ้าแก่ (ถ้ามี) */
  escalation: { kind: HandoffKind; brief: string[]; status: "open" | "resolved"; at: string } | null;
};

/** คำตอบด่วนตามประเภทเรื่อง — ข้อความจากไฟล์ดีไซน์ Owner-Chat */
export function quickReplies(kind: HandoffKind | null): string[] {
  if (kind === "refund" || kind === "complaint") return ["ขอรูปของที่เสียหน่อยครับ", "เดี๋ยวเฮียโทรกลับครับ"];
  return ["เดี๋ยวเฮียโทรกลับครับ"];
}

/**
 * สินค้าที่เถ้าแก่อนุมัติราคาเองได้ — มีต้นทุน/ราคาพื้น ส่งให้หน้าแชตเถ้าแก่เท่านั้น (requireOwner)
 * แยกจาก OwnerChatView ซึ่งไม่มีตัวเลขหลังบ้าน
 */
export type ApprovalProduct = { sku: string; name: string; listPrice: number; unitCost: number; floorPrice: number };

/** ค่าเริ่มต้นของฟอร์มอนุมัติราคา: สินค้า/จำนวนจากการ์ดข้อเสนอล่าสุด (จำนวนที่ลูกค้าขอ ไม่ใช่จำนวนข้อ "ซื้อเยอะ") */
export function approvalDefaults(messages: ChatMessage[], products: ApprovalProduct[]): { sku: string; qty: number | null } {
  const card = lastOffers(messages);
  const known = (sku: string | undefined) => (sku && products.some((p) => p.sku === sku) ? sku : undefined);
  if (card && known(card.sku)) return { sku: card.sku, qty: askedQty(messages, card.sku) };
  const shown = [...messages].reverse().find((m) => m.type === "product_card");
  return { sku: known(shown?.type === "product_card" ? shown.sku : undefined) ?? products[0]?.sku ?? "", qty: null };
}

/** chip ราคาแนะนำในฟอร์มอนุมัติ — กดแล้วเติมช่องที่มีค่า (ไม่มี qty/creditDays = ไม่แตะช่องนั้น) */
export type ApprovalSuggestion = { label: string; pricePerUnit: number; qty?: number; creditDays?: number };

/**
 * ราคาที่เถ้าแก่น่าจะอยากอนุมัติ ตามลำดับ: ราคาที่ลูกค้าขอ → ข้อเสนอในการ์ดล่าสุดของสินค้านี้ → ราคาปกติ
 * ราคาซ้ำกันเหลือ chip แรก · ฟอร์มไม่เลือกให้เอง เพราะราคาที่ลูกค้าขออาจต่ำกว่าราคาพื้น
 */
export function approvalSuggestions(messages: ChatMessage[], products: ApprovalProduct[], sku: string): ApprovalSuggestion[] {
  const product = products.find((p) => p.sku === sku);
  if (!product) return [];
  const chips: ApprovalSuggestion[] = [];

  const asked = lastAskedPrice(aboutProduct(messages, products, sku), products, sku);
  if (asked !== null) {
    const qty = askedQty(messages, sku);
    chips.push({ label: `ลูกค้าขอ ${formatBaht(asked)}`, pricePerUnit: asked, ...(qty !== null && { qty }) });
  }
  const card = messages.findLast((m) => m.type === "offers" && m.sku === sku);
  for (const o of card?.type === "offers" ? card.offers : []) {
    chips.push({
      label: `${o.id} ${o.label} ${formatBaht(o.pricePerUnit)} × ${formatQty(o.qty)}`,
      pricePerUnit: o.pricePerUnit,
      qty: o.qty,
      creditDays: o.creditDays,
    });
  }
  chips.push({ label: `ราคาปกติ ${formatBaht(product.listPrice)}`, pricePerUnit: product.listPrice });

  return chips.filter((c, i) => chips.findIndex((x) => x.pricePerUnit === c.pricePerUnit) === i);
}

/**
 * ตัดข้อความลูกค้าที่พูดถึงสินค้าอื่นออก — สินค้าของข้อความ = ที่พิมพ์ชื่อมาเอง หรือที่คุยอยู่ตอนนั้น (การ์ดล่าสุด)
 * ยังไม่รู้ว่าสินค้าไหน (ขอราคาก่อนมีการ์ด) ให้นับไว้
 */
function aboutProduct(messages: ChatMessage[], products: ApprovalProduct[], sku: string): ChatMessage[] {
  let current: string | null = null;
  return messages.filter((m) => {
    if (m.type === "product_card" || m.type === "offers") current = m.sku;
    if (m.type !== "buyer_text") return true;
    const about = fallbackIntent(m.text, { products, lastSku: current }).sku;
    return about === null || about === sku;
  });
}

/** ตัวเลขที่เถ้าแก่เห็นก่อนกดอนุมัติ — คิดในเครื่องได้ เพราะเป็นหน้าเถ้าแก่และไม่ได้ใช้ตัดสินราคาจริง (server คิดใหม่) */
export function approvalPreview(product: ApprovalProduct, price: number, qty: number) {
  const total = Math.round(price * qty * 100) / 100;
  const profit = Math.round((price - product.unitCost) * qty * 100) / 100;
  const cost = product.unitCost * qty;
  return {
    total,
    profit,
    profitPctOfCost: cost > 0 ? Math.round((profit / cost) * 100) : null,
    belowFloor: price < product.floorPrice,
    belowCost: price < product.unitCost,
  };
}

/**
 * จำนวนที่ลูกค้าขอในรอบต่อรองนี้ = จำนวนของข้อที่ไม่ใช่ "ซื้อเยอะ" ในการ์ดล่าสุดที่มีข้อแบบนั้น
 * ลูกค้าไม่เอาข้ออื่นจนเหลือแค่ "ซื้อเยอะ" (เช่น 1,500) → ย้อนดูการ์ดก่อนหน้า · ไม่เจอ = null ให้เถ้าแก่กรอกเอง ไม่เดา
 */
function askedQty(messages: ChatMessage[], sku: string): number | null {
  for (const m of sinceLastOrder(messages).reverse()) {
    if (m.type !== "offers" || m.sku !== sku) continue;
    const asked = m.offers.find((o) => o.lever !== "volume");
    if (asked) return asked.qty;
  }
  return null;
}
