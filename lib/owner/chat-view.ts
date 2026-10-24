// สิ่งที่หน้าแชตเถ้าแก่ (/owner/chats/[id]) ใช้วาด — ไม่มีตัวเลขหลังบ้าน (ต้นทุน/margin) อยู่ในนี้
import type { HandoffKind } from "@/lib/chat/replies";
import { lastOffers } from "@/lib/chat/suggestions";
import type { ChatMessage } from "@/lib/chat/types";

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
  const sinceOrder = messages.slice(messages.findLastIndex((m) => m.type === "order_summary") + 1);
  for (const m of [...sinceOrder].reverse()) {
    if (m.type !== "offers" || m.sku !== sku) continue;
    const asked = m.offers.find((o) => o.lever !== "volume");
    if (asked) return asked.qty;
  }
  return null;
}
