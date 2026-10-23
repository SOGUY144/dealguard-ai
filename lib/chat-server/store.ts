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
export type StoredOffer = { rowId: string; sku: string; offer: Offer };

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
  setMode(chatId: string, mode: StoredChat["mode"]): Promise<void>;
  /**
   * บันทึกตัวนับการต่อราคาเฉพาะเมื่อค่าในที่เก็บยังเท่ากับ expected
   * false = อีกคำขอเปลี่ยนไปก่อน (ลูกค้าส่งจากสองแท็บพร้อมกัน) → ต้องอ่านใหม่แล้วคิดใหม่
   */
  setNegotiation(chatId: string, expected: NegotiationState, next: NegotiationState): Promise<boolean>;
  /** เก็บข้อเสนอ + margin (ตารางที่ลูกค้าอ่านไม่ได้) ผูกกับข้อความการ์ดข้อเสนอ */
  saveOffers(chatId: string, messageId: string, sku: string, priced: PricedOffer[]): Promise<void>;
  findOffer(chatId: string, messageId: string, letter: Offer["id"]): Promise<StoredOffer | null>;
  /** null = ข้อเสนอนี้เป็นออเดอร์ไปแล้ว (กดซ้ำ/ส่งซ้อน) */
  createOrder(input: {
    chatId: string;
    buyerId: string;
    offerRowId: string;
    productName: string;
  }): Promise<{ orderId: string } | null>;
  createEscalation(chatId: string, kind: HandoffKind, brief: Brief): Promise<void>;
}
