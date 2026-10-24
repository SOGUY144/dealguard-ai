// อ่านข้อมูลหัวแชตด้วย client ของผู้ใช้ (RLS) — เรียกจาก server action ใน app/owner/chat-heads-actions.ts
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { toMessage } from "@/lib/chat-server/supabase-store";
import { toChatHeadSource, type ChatHeadSource } from "./chat-heads";

type Row = Record<string, unknown>;

/** แชตล่าสุดที่ดูมากสุด (ลูกค้าทักใหม่ = แชตนั้นขึ้นมาอยู่บนสุดเสมอ) */
const CHAT_LIMIT = 20;
/** แชตที่เงียบเกินนี้ไม่ต้องดู — หัวแชตเด้งเฉพาะความเคลื่อนไหวล่าสุด */
const RECENT_MS = 24 * 60 * 60 * 1000;
/** ข้อความลูกค้า/การส่งเรื่องล่าสุดต่อแชตที่อ่าน (ใช้แค่ตัวล่าสุด เผื่อไว้นิดหน่อย) */
const PER_CHAT = 3;

const one = (v: unknown): Row | null => (Array.isArray(v) ? ((v[0] as Row) ?? null) : ((v as Row) ?? null));

export async function readChatHeadSources(db: SupabaseClient, now = new Date()): Promise<ChatHeadSource[]> {
  const chats = await db
    .from("chats")
    .select("id, mode, updated_at, profiles!inner(display_name, role)")
    .eq("profiles.role", "buyer")
    .gte("updated_at", new Date(now.getTime() - RECENT_MS).toISOString())
    .order("updated_at", { ascending: false })
    .limit(CHAT_LIMIT);
  if (chats.error) throw new Error(`[owner] อ่านแชตสำหรับหัวแชต: ${chats.error.message}`);
  const rows = chats.data as Row[];
  if (rows.length === 0) return [];

  const messages = await db
    .from("messages")
    .select("*")
    .in("chat_id", rows.map((r) => String(r.id)))
    .in("type", ["buyer_text", "handoff"])
    .order("seq", { ascending: false })
    .limit(rows.length * PER_CHAT * 4);
  if (messages.error) throw new Error(`[owner] อ่านข้อความสำหรับหัวแชต: ${messages.error.message}`);
  const byChat = new Map<string, Row[]>();
  for (const m of messages.data as Row[]) {
    const list = byChat.get(String(m.chat_id)) ?? [];
    if (list.length < PER_CHAT) list.push(m);
    byChat.set(String(m.chat_id), list);
  }

  return rows.map((r) =>
    toChatHeadSource(
      String(r.id),
      String(one(r.profiles)?.display_name ?? "ลูกค้า"),
      r.mode === "human" ? "human" : "ai",
      (byChat.get(String(r.id)) ?? []).reverse().map(toMessage),
    ),
  );
}
