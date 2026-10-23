// เถ้าแก่จัดการแชต (หน้า /owner/chats/[id]) — ตอบเอง / ปิดเรื่อง / ให้ AI ตอบต่อ
// เรียกจาก server หลังเช็กว่าเป็น owner แล้วเท่านั้น (เขียนด้วย service role)
import "server-only";
import type { ChatStore } from "./store";

/** ข้อความของเถ้าแก่ยาวได้มากกว่าลูกค้า (อธิบายเงื่อนไขคืนเงิน ฯลฯ) */
export const OWNER_TEXT_MAX = 1000;

export type OwnerChatAction =
  | { type: "reply"; text: string }
  /** ปิดเรื่องที่ส่งมา แต่เถ้าแก่ยังคุยต่อเอง */
  | { type: "resolve" }
  /** ให้ AI ตอบต่อ — ปิดเรื่องด้วย */
  | { type: "handback" };

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
    case "handback":
      await store.resolveEscalations(chatId);
      if (chat.mode === "human") {
        await store.setMode(chatId, "ai");
        await store.appendMessages(chatId, [{ type: "system", kind: "ai_resumed" }]);
      }
      return;
  }
}
