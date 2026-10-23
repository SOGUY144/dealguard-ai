// ที่เก็บแชตฝั่ง server — pipeline คุยกับ interface นี้เท่านั้น (test ใช้ memory, ของจริงใช้ Supabase)
import "server-only";
import type { HandoffKind, Brief } from "@/lib/chat/replies";
import type { ChatMessage, ChatMessageDraft, Offer } from "@/lib/chat/types";
import type { MerchantConfig, NegotiationState, PricedOffer } from "@/lib/deal-engine/types";

export type StoredChat = {
  id: string;
  buyerId: string;
  mode: "ai" | "human";
  negotiation: NegotiationState;
};

/** ข้อเสนอที่ server เคยเสนอจริง — ยืนยันออเดอร์จากแถวนี้ ไม่รับตัวเลขจาก browser */
export type StoredOffer = { rowId: string; sku: string; offer: Offer; createdAt: string };

export interface ChatStore {
  loadConfig(): Promise<MerchantConfig>;
  /** แชตล่าสุดของลูกค้าคนนี้ */
  findChat(buyerId: string): Promise<StoredChat | null>;
  /**
   * สร้างแชตพร้อมข้อความทักทาย — ลูกค้า 1 คนมีแชตเดียว (unique ในฐานข้อมูล)
   * ถ้ามีอยู่แล้ว (เช่น เปิดสองแท็บพร้อมกัน) คืนแชตเดิมโดยไม่ทักซ้ำ
   */
  createChat(buyerId: string, greeting: ChatMessageDraft): Promise<StoredChat>;
  listMessages(chatId: string): Promise<ChatMessage[]>;
  /** เพิ่มข้อความตามลำดับ (เวลาเรียงกันเสมอ) แล้วคืนข้อความที่มี id แล้ว */
  appendMessages(chatId: string, drafts: ChatMessageDraft[]): Promise<ChatMessage[]>;
  updateMessage(chatId: string, message: ChatMessage): Promise<void>;
  /** ถอนข้อความที่เพิ่งเพิ่ม — ตอนบันทึกส่วนที่เหลือไม่สำเร็จ (ลูกค้าจะส่งใหม่ ไม่ให้ซ้ำ) */
  deleteMessages(chatId: string, ids: string[]): Promise<void>;
  /** ออเดอร์ที่มาจากการ์ดข้อเสนอนี้ (มีได้ใบเดียว) */
  findOrderForCard(
    chatId: string,
    offerMessageId: string,
  ): Promise<{ orderId: string; letter: Offer["id"]; createdAt: string } | null>;
  setMode(chatId: string, mode: StoredChat["mode"]): Promise<void>;
  /**
   * บันทึกตัวนับการต่อราคาเฉพาะเมื่อค่าในที่เก็บยังเท่ากับ expected
   * false = อีกคำขอเปลี่ยนไปก่อน (ลูกค้าส่งจากสองแท็บพร้อมกัน) → ต้องอ่านใหม่แล้วคิดใหม่
   */
  setNegotiation(chatId: string, expected: NegotiationState, next: NegotiationState): Promise<boolean>;
  /** เก็บข้อเสนอ + margin (ตารางที่ลูกค้าอ่านไม่ได้) ผูกกับข้อความการ์ดข้อเสนอ */
  saveOffers(chatId: string, messageId: string, sku: string, priced: PricedOffer[]): Promise<void>;
  findOffer(chatId: string, messageId: string, letter: Offer["id"]): Promise<StoredOffer | null>;
  /**
   * ออเดอร์ + หักสต๊อกของแถม ในคำสั่งเดียว
   * null = การ์ดข้อเสนอนี้เป็นออเดอร์ไปแล้ว (กดซ้ำ / ยืนยันข้อ A กับ B พร้อมกัน) หรือของแถมไม่พอ
   */
  createOrder(input: {
    chatId: string;
    buyerId: string;
    offerRowId: string;
    offerMessageId: string;
    productName: string;
    gift?: { sku?: string; name: string; qty: number };
  }): Promise<{ orderId: string } | null>;
  /** ส่งเรื่องให้เถ้าแก่ + เปลี่ยนแชตเป็นโหมด human ในคำสั่งเดียว (ห้ามเกิดครึ่งเดียว) */
  escalate(chatId: string, kind: HandoffKind, brief: Brief): Promise<void>;
}
