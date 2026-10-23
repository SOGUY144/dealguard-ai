// ข้อมูลที่หน้าแชตลูกค้าใช้ (HANDOFF §5) — ไฟล์นี้ใช้ได้ทั้ง server และ browser จึงห้ามมีต้นทุน/ราคาพื้น
import type { Offer } from "@/lib/deal-engine/types";

export type { Offer };

/** สินค้าที่ลูกค้าเห็นได้ — ไม่มี unitCost / floorPrice / tiers */
export type PublicProduct = { sku: string; name: string; listPrice: number };

/** ข้อมูลร้านที่แสดงฝั่งลูกค้า (ส่งเป็น props จาก server) */
export type Storefront = {
  storeName: string;
  tagline: string;
  ownerName: string;
  assistantName: string;
  bankAccountName: string;
  contactChannel: string;
  orderRefPlaceholder: string;
};

type Base = { id: string; at: string };

export type ChatMessage = Base &
  (
    | { type: "ai_text"; text: string; cta?: "open_products" | "show_offers" }
    | { type: "ai_voice"; audioUrl?: string; durationSec: number; transcript: string }
    | { type: "buyer_text"; text: string; inputMode: "text" | "voice" }
    | { type: "product_card"; sku: string; name: string; listPrice: number }
    | { type: "offers"; offers: Offer[]; selectedId?: Offer["id"]; confirmed?: boolean }
    | { type: "order_summary"; orderId: string; offer: Offer; productName: string }
    | { type: "handoff"; subject: string; orderRef?: string }
    | { type: "system"; kind: "price_locked" | "voice_unavailable" }
  );

export type ChatMessageOf<T extends ChatMessage["type"]> = Extract<ChatMessage, { type: T }>;

/** ข้อความที่อยู่ฝั่ง AI (ซ้าย) — ข้อความติดกันจะอยู่ใต้ avatar เดียว */
export const AI_SIDE: ReadonlySet<ChatMessage["type"]> = new Set([
  "ai_text",
  "ai_voice",
  "offers",
  "order_summary",
  "handoff",
]);
