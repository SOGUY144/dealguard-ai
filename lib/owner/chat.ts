// อ่านแชตให้หน้าเถ้าแก่ด้วย client ของผู้ใช้ (RLS: owner อ่านได้ทุกแชต ลูกค้าอ่านได้แค่ของตัวเอง)
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { HandoffKind } from "@/lib/chat/replies";
import { toMessage } from "@/lib/chat-server/supabase-store";
import type { OwnerChatView } from "./chat-view";

type Row = Record<string, unknown>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** null = ไม่มีแชตนี้ หรือไม่มีสิทธิ์อ่าน */
export async function readOwnerChat(db: SupabaseClient, chatId: string): Promise<OwnerChatView | null> {
  if (!UUID.test(chatId)) return null;
  const [chat, messages, escalation] = await Promise.all([
    db.from("chats").select("id, mode, profiles(display_name)").eq("id", chatId).maybeSingle(),
    db.from("messages").select("*").eq("chat_id", chatId).order("seq"),
    db
      .from("escalations")
      .select("kind, brief, status, created_at")
      .eq("chat_id", chatId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  for (const r of [chat, messages, escalation]) {
    if (r.error) throw new Error(`[owner] อ่านแชต: ${r.error.message}`);
  }
  if (!chat.data) return null;

  const profile = chat.data.profiles as unknown as Row | Row[] | null;
  const buyer = Array.isArray(profile) ? profile[0] : profile;
  const esc = escalation.data as Row | null;
  return {
    chatId: String(chat.data.id),
    mode: chat.data.mode === "human" ? "human" : "ai",
    buyerName: String(buyer?.display_name ?? "ลูกค้า"),
    messages: (messages.data as Row[]).map(toMessage),
    escalation: esc
      ? {
          kind: esc.kind as HandoffKind,
          brief: (esc.brief as string[]) ?? [],
          status: esc.status === "resolved" ? "resolved" : "open",
          at: new Date(String(esc.created_at)).toISOString(),
        }
      : null,
  };
}
