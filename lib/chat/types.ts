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
    | {
        type: "ai_text";
        text: string;
        cta?: "open_products" | "show_offers";
        /** ให้ chip เลือกข้อเสนอเดิม (ซื้อเยอะ / จ่ายสด) ขึ้นหลังข้อความนี้ */
        suggest?: "trade_offs";
      }
    | { type: "ai_voice"; audioUrl?: string; durationSec: number; transcript: string }
    | { type: "buyer_text"; text: string; inputMode: "text" | "voice" }
    /** เถ้าแก่ตอบเองในชื่อร้าน (หลังส่งเรื่องให้เถ้าแก่ / เถ้าแก่รับช่วงต่อ) */
    | { type: "owner_text"; text: string }
    | { type: "product_card"; sku: string; name: string; listPrice: number }
    | {
        type: "offers";
        /** สินค้าที่ต่อราคาอยู่ — ใบสรุปออเดอร์ใช้ค่านี้ ไม่ใช่สินค้าล่าสุดในแชต */
        sku: string;
        offers: Offer[];
        selectedId?: Offer["id"];
        confirmed?: boolean;
      }
    | { type: "order_summary"; orderId: string; offer: Offer; productName: string }
    | { type: "handoff"; subject: string; orderRef?: string }
    | { type: "system"; kind: "price_locked" | "voice_unavailable" | "ai_resumed" }
  );

export type ChatMessageOf<T extends ChatMessage["type"]> = Extract<ChatMessage, { type: T }>;

/** ข้อความที่ยังไม่มี id/เวลา (ผู้เก็บข้อมูลเป็นคนใส่ให้) */
export type ChatMessageDraft = ChatMessage extends infer M ? (M extends ChatMessage ? Omit<M, "id" | "at"> : never) : never;

/** ข้อความที่อยู่ฝั่ง AI (ซ้าย) — ข้อความติดกันจะอยู่ใต้ avatar เดียว */
export const AI_SIDE: ReadonlySet<ChatMessage["type"]> = new Set([
  "ai_text",
  "ai_voice",
  "offers",
  "order_summary",
  "handoff",
]);
