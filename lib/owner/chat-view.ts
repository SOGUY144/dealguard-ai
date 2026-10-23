// สิ่งที่หน้าแชตเถ้าแก่ (/owner/chats/[id]) ใช้วาด — ไม่มีตัวเลขหลังบ้าน (ต้นทุน/margin) อยู่ในนี้
import type { HandoffKind } from "@/lib/chat/replies";
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
