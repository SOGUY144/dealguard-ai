// สถานะหน้าแชตจริงฝั่ง browser — การเลือกข้อเสนอเกิดในเครื่องอย่างเดียว (server รู้ตอนกดยืนยัน)
import type { ChatView } from "./actions";
import type { ChatMessage, Offer } from "./types";

/** เลือกข้อเสนอในการ์ด — การ์ดที่ยืนยันแล้วเปลี่ยนไม่ได้ */
export function selectOffer(view: ChatView, messageId: string, offerId: Offer["id"]): ChatView {
  return {
    ...view,
    messages: view.messages.map((m) =>
      m.id === messageId && m.type === "offers" && !m.confirmed ? { ...m, selectedId: offerId } : m,
    ),
  };
}

/** หน้าจอใหม่จาก server + เก็บข้อเสนอที่ลูกค้าเลือกไว้ในเครื่อง + ข้อที่ server ชี้ให้ (focus) */
export function mergeServerView(prev: ChatView, next: ChatView): ChatView {
  const picked = new Map<string, Offer["id"]>();
  for (const m of prev.messages) if (m.type === "offers" && m.selectedId) picked.set(m.id, m.selectedId);

  const messages = next.messages.map((m): ChatMessage => {
    if (m.type !== "offers" || m.confirmed) return m;
    const selectedId = next.focus?.messageId === m.id ? next.focus.offerId : (m.selectedId ?? picked.get(m.id));
    return selectedId ? { ...m, selectedId } : m;
  });
  if (next.notice === "confirm_unavailable") {
    const at = new Date().toISOString();
    messages.push({
      id: `local-notice-${at}`,
      at,
      type: "ai_text",
      text: "ข้อเสนอนี้ยืนยันไม่ได้แล้วครับ เลือกจากข้อเสนอล่าสุด หรือบอกจำนวนกับราคาใหม่ได้เลยครับ",
    });
  }
  return { ...next, messages };
}

const PENDING_PREFIX = "pending-";

/** แสดงข้อความลูกค้าทันทีระหว่างรอ server */
export function withPendingBuyerText(view: ChatView, text: string, inputMode: "text" | "voice", at: string): ChatView {
  return {
    ...view,
    suggestions: [],
    messages: [...view.messages, { id: `${PENDING_PREFIX}${at}`, at, type: "buyer_text", text, inputMode }],
  };
}

/**
 * ส่งไม่สำเร็จ: เอาข้อความที่ยังไม่ถึง server ออก แล้วบอกให้ลองใหม่ (ข้อความนี้อยู่ในเครื่อง ไม่ถูกเก็บ)
 * restore = chip ก่อนส่ง (ตอนรอคำตอบซ่อนไว้) ให้กลับมา
 */
export function withSendError(view: ChatView, at: string, restore: ChatView["suggestions"] = view.suggestions): ChatView {
  return {
    ...view,
    suggestions: restore,
    messages: [
      ...view.messages.filter((m) => !m.id.startsWith(PENDING_PREFIX)),
      { id: `local-error-${at}`, at, type: "ai_text", text: "ขอโทษครับ ส่งไม่สำเร็จ ลองส่งใหม่อีกครั้งนะครับ" },
    ],
  };
}
