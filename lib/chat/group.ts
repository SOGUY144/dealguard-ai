import { AI_SIDE, type ChatMessage } from "./types";

export type MessageRow = {
  /** owner = เถ้าแก่ตอบเอง (ฝั่งร้าน แต่ไม่ใช่ AI — ใช้ avatar คนละแบบ) */
  kind: "ai" | "owner" | "buyer" | "notice";
  /** id ของข้อความแรกในแถว ใช้เป็น React key */
  id: string;
  messages: ChatMessage[];
};

function sideOf(m: ChatMessage): MessageRow["kind"] {
  if (m.type === "system") return m.kind === "voice_unavailable" ? "ai" : "notice";
  if (m.type === "owner_text") return "owner";
  return AI_SIDE.has(m.type) ? "ai" : "buyer";
}

/** ข้อความฝั่ง AI (หรือเถ้าแก่) ที่ติดกันรวมเป็นแถวเดียว (avatar เดียว) ส่วนข้อความลูกค้ากับ chip กลางจอแยกแถว */
export function groupMessages(messages: ChatMessage[]): MessageRow[] {
  const rows: MessageRow[] = [];
  for (const m of messages) {
    const kind = sideOf(m);
    const prev = rows.at(-1);
    if ((kind === "ai" || kind === "owner") && prev?.kind === kind) prev.messages.push(m);
    else rows.push({ kind, id: m.id, messages: [m] });
  }
  return rows;
}
