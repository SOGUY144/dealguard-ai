// ส่งการกระทำของลูกค้าไป /api/chat — browser ส่งแค่ข้อความ/id ไม่ส่งตัวเลขราคา
import type { ChatAction, ChatView } from "./actions";

/** การกระทำที่ต้องให้ server ทำ (เลือกข้อเสนอเกิดในเครื่องอย่างเดียว) */
export type ServerAction = Exclude<ChatAction, { type: "select_offer" }>;
export type ChatTransport = (action: ServerAction) => Promise<ChatView>;

/** session หมดอายุ — ต้องล็อกอินใหม่ */
export class UnauthorizedError extends Error {}

/** โหลดแชตล่าสุด (มีข้อความใหม่จากเถ้าแก่ / โหมดเปลี่ยน) */
export async function fetchChatView(): Promise<ChatView> {
  const res = await fetch("/api/chat", { cache: "no-store" });
  if (res.status === 401) throw new UnauthorizedError("unauthorized");
  if (!res.ok) throw new Error(`chat ${res.status}`);
  return (await res.json()) as ChatView;
}

export const fetchChatTransport: ChatTransport = async (action) => {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(action),
  });
  if (res.status === 401) throw new UnauthorizedError("unauthorized");
  if (!res.ok) throw new Error(`chat ${res.status}`);
  return (await res.json()) as ChatView;
};
