// การกระทำของลูกค้าในแชต + ผลที่หน้าจอได้กลับไป — ใช้ร่วมกันทั้ง mock, API และ UI
import type { ChatMessage, Offer } from "./types";

export type ChatAction =
  | { type: "pick_product"; sku: string }
  | { type: "send"; text: string; inputMode: "text" | "voice" }
  /** เลือกข้อเสนอ — เกิดในหน้าจออย่างเดียว ไม่ส่งไป server */
  | { type: "select_offer"; messageId: string; offerId: Offer["id"] }
  /** ยืนยัน — server หาข้อเสนอจากฐานข้อมูลเอง ไม่รับตัวเลขจาก browser */
  | { type: "confirm_offer"; messageId: string; offerId: Offer["id"] }
  | { type: "talk_to_human" };

/** chip คำตอบด่วนเหนือช่องพิมพ์ */
export type Suggestion = {
  label: string;
  action:
    | { type: "open_products" }
    | Extract<ChatAction, { type: "send" }>
    /** เลือกข้อเสนอที่มีอยู่แล้ว (เช่น "สั่ง 1,500 ชิ้น" = ข้อ A) ไม่ใช่ต่อราคาใหม่ */
    | Extract<ChatAction, { type: "select_offer" }>;
};

/** สิ่งที่หน้าแชตต้องใช้วาดทั้งหมด */
export type ChatView = {
  /** id แชต — หน้าจอใช้ฟังข้อความใหม่ (เถ้าแก่ตอบ) ผ่าน Realtime · ตัวตอบจำลองไม่มี */
  chatId?: string;
  messages: ChatMessage[];
  suggestions: Suggestion[];
  /** human = ส่งเรื่องให้เถ้าแก่แล้ว AI หยุดตอบ */
  mode: "ai" | "human";
  /** ให้หน้าจอเลือกข้อเสนอนี้ให้ (เช่น ลูกค้าพิมพ์ "สั่ง 1,500 ชิ้น" ตรงกับข้อ A ที่เพิ่งเสนอ) */
  focus?: { messageId: string; offerId: Offer["id"] };
  /** ทำตามที่ขอไม่ได้ — หน้าจอต้องบอกลูกค้า (เช่น ข้อเสนอเก่า/ยืนยันไปแล้ว) ไม่ถูกเก็บในแชต */
  notice?: "confirm_unavailable";
};
