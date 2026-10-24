// อ่านข้อมูลหน้าเถ้าแก่ด้วย client ของผู้ใช้ (RLS) — ตาราง margin / escalations อ่านได้เฉพาะ owner
// ถ้าคนที่ไม่ใช่ owner เรียก จะได้ตัวเลข margin ว่าง (ไม่ใช่ข้อมูลของร้าน) แต่หน้า /owner เช็ก requireOwner ก่อนเสมอ
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { HandoffKind } from "@/lib/chat/replies";
import { toMessage, toOffer } from "@/lib/chat-server/supabase-store";
import {
  activeChatStatus,
  bangkokDayStart,
  chatPreview,
  type ActiveChat,
  type EscalationEntry,
  type OwnerDeal,
  type OwnerEscalation,
} from "./summary";

type Row = Record<string, unknown>;

/** embed แบบหนึ่งต่อหนึ่ง PostgREST อาจคืนเป็น object หรือ array ตามความสัมพันธ์ */
const one = (v: unknown): Row | null => (Array.isArray(v) ? ((v[0] as Row) ?? null) : ((v as Row) ?? null));

/** รายการเรื่องรอตัดสินที่แสดงได้มากสุด (จำนวนจริงนับแยก) */
const ESCALATION_LIST_LIMIT = 20;
/** หน้าดีลทั้งหมด / รอตัดสิน แสดงได้มากสุด (ร้านเดียวในเดโม พอเหลือ) */
const DEAL_HISTORY_LIMIT = 1000;
const ESCALATION_HISTORY_LIMIT = 200;
/** แชตที่กำลังคุยที่แสดงในหน้าภาพรวม */
const ACTIVE_CHAT_LIMIT = 8;
/** ข้อความล่าสุดต่อแชตที่ใช้ดูสถานะ/ตัวอย่างข้อความ */
const PREVIEW_MESSAGES = 4;

export type OwnerData = {
  deals: OwnerDeal[];
  escalations: OwnerEscalation[];
  /** จำนวนเรื่องรอตัดสินตามจริง ทุกวัน (รายการอาจตัดไว้ที่ ESCALATION_LIST_LIMIT) */
  openCount: number;
  /** ออเดอร์ที่อ่าน margin ไม่ได้ (ข้อมูลไม่ครบ) — ควรเป็น 0 เสมอ */
  incompleteDeals: number;
  /** แชตของลูกค้าที่มีความเคลื่อนไหววันนี้ ล่าสุดก่อน */
  activeChats: ActiveChat[];
};

export async function readOwnerData(db: SupabaseClient, now = new Date()): Promise<OwnerData> {
  const since = bangkokDayStart(now).toISOString();
  // เรื่องที่ยังไม่ปิด ทุกวัน (รีวิวรอบ 3): เรื่องคืนเงินตอน 23:40 ต้องยังเตือนเช้าวันถัดไป จนกว่าเถ้าแก่จะปิดเรื่อง
  const [{ deals, incompleteDeals }, escalations] = await Promise.all([
    readDeals(db, since),
    db
      .from("escalations")
      .select("id, chat_id, kind, brief, created_at", { count: "exact" })
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(ESCALATION_LIST_LIMIT),
  ]);
  if (escalations.error) throw new Error(`[owner] อ่านเรื่องที่ส่งต่อ: ${escalations.error.message}`);

  return {
    deals,
    incompleteDeals,
    activeChats: await readActiveChats(db, since),
    openCount: escalations.count ?? escalations.data.length,
    escalations: (escalations.data as Row[]).map((e) => ({
      id: String(e.id),
      chatId: String(e.chat_id),
      kind: e.kind as HandoffKind,
      brief: (e.brief as string[]) ?? [],
      at: new Date(String(e.created_at)).toISOString(),
    })),
  };
}

/** ดีลที่ปิดได้ตั้งแต่ since (null = ทั้งหมด) เก่าก่อน — หน้าภาพรวม (วันนี้) และหน้าดีลทั้งหมด */
export async function readDeals(
  db: SupabaseClient,
  since: string | null,
): Promise<{ deals: OwnerDeal[]; incompleteDeals: number }> {
  let query = db
    .from("orders")
    // เฉพาะออเดอร์ของบัญชีลูกค้า — เถ้าแก่/กรรมการลองสั่งเองจากหน้าลูกค้าไม่นับเป็นดีลของ AI
    .select("id, chat_id, created_at, paid_at, product_name, profiles!inner(display_name, role), offers(*, offer_economics(*))")
    .eq("profiles.role", "buyer");
  if (since) query = query.gte("created_at", since);
  // ล่าสุดก่อนแล้วกลับลำดับ — เกินเพดานแล้วตัดของเก่าทิ้ง ไม่ใช่ตัดของใหม่
  const orders = await query.order("created_at", { ascending: false }).limit(DEAL_HISTORY_LIMIT);
  if (orders.error) throw new Error(`[owner] อ่านออเดอร์: ${orders.error.message}`);
  orders.data.reverse();

  const deals: OwnerDeal[] = [];
  let incompleteDeals = 0;
  for (const row of orders.data as Row[]) {
    const offerRow = one(row.offers);
    const econ = offerRow && one(offerRow.offer_economics);
    if (!offerRow || !econ) {
      // ไม่ควรเกิด (ข้อเสนอ + margin เขียนพร้อมกันแล้ว) — นับไว้ให้หน้าเตือน และลง log ให้ตามได้
      incompleteDeals += 1;
      console.warn(`[owner] ออเดอร์ ${String(row.id)} ไม่มี margin — ไม่ถูกนับในยอด`);
      continue;
    }
    deals.push({
      id: String(row.id),
      chatId: String(row.chat_id),
      at: new Date(String(row.created_at)).toISOString(),
      buyerName: String(one(row.profiles)?.display_name ?? "ลูกค้า"),
      productName: String(row.product_name),
      offer: toOffer(offerRow),
      marginIfConceded: Number(econ.margin_if_conceded),
      marginOffer: Number(econ.margin_offer),
      recoveredMargin: Number(econ.recovered_margin),
      paidAt: row.paid_at ? new Date(String(row.paid_at)).toISOString() : null,
    });
  }
  return { deals, incompleteDeals };
}

/** เรื่องที่ส่งให้เถ้าแก่ทุกวัน (ไม่ใช่แค่วันนี้) ล่าสุดก่อน — หน้ารอตัดสิน */
export async function readEscalationHistory(db: SupabaseClient, status: "open" | "resolved"): Promise<EscalationEntry[]> {
  const res = await db
    .from("escalations")
    .select("id, chat_id, kind, brief, status, created_at, chats(profiles(display_name))")
    .eq("status", status)
    .order("created_at", { ascending: false })
    .limit(ESCALATION_HISTORY_LIMIT);
  if (res.error) throw new Error(`[owner] อ่านเรื่องที่ส่งต่อ: ${res.error.message}`);
  return (res.data as Row[]).map((e) => ({
    id: String(e.id),
    chatId: String(e.chat_id),
    kind: e.kind as HandoffKind,
    brief: (e.brief as string[]) ?? [],
    at: new Date(String(e.created_at)).toISOString(),
    status: e.status === "resolved" ? "resolved" : "open",
    buyerName: String(one(one(e.chats)?.profiles)?.display_name ?? "ลูกค้า"),
  }));
}

/** จำนวนเรื่องรอตัดสินทั้งหมด (ทุกวัน) — badge ในเมนู · now ไม่ได้ใช้แล้ว เก็บไว้ให้เรียกแบบเดิมได้ */
export async function countOpenEscalations(db: SupabaseClient, _now = new Date()): Promise<number> {
  void _now;
  const { count, error } = await db
    .from("escalations")
    .select("id", { count: "exact", head: true })
    .eq("status", "open");
  if (error) throw new Error(`[owner] นับเรื่องที่ส่งต่อ: ${error.message}`);
  return count ?? 0;
}

/** แชตของลูกค้า (ไม่รวมบัญชีเถ้าแก่) ที่มีความเคลื่อนไหวตั้งแต่ since — สถานะ + ข้อความล่าสุด */
async function readActiveChats(db: SupabaseClient, since: string): Promise<ActiveChat[]> {
  const chats = await db
    .from("chats")
    .select("id, mode, updated_at, profiles!inner(display_name, role)")
    .eq("profiles.role", "buyer")
    .gte("updated_at", since)
    .order("updated_at", { ascending: false })
    .limit(ACTIVE_CHAT_LIMIT);
  if (chats.error) throw new Error(`[owner] อ่านแชตที่กำลังคุย: ${chats.error.message}`);
  const rows = chats.data as Row[];
  if (rows.length === 0) return [];

  // ข้อความล่าสุดของทุกแชตในคำขอเดียว แล้วแบ่งตามแชต
  const messages = await db
    .from("messages")
    .select("*")
    .in("chat_id", rows.map((r) => String(r.id)))
    .order("seq", { ascending: false })
    .limit(rows.length * PREVIEW_MESSAGES * 6);
  if (messages.error) throw new Error(`[owner] อ่านข้อความล่าสุด: ${messages.error.message}`);
  const byChat = new Map<string, Row[]>();
  for (const m of messages.data as Row[]) {
    const list = byChat.get(String(m.chat_id)) ?? [];
    if (list.length < PREVIEW_MESSAGES) list.push(m);
    byChat.set(String(m.chat_id), list);
  }

  return rows.map((r) => {
    const recent = (byChat.get(String(r.id)) ?? []).reverse().map(toMessage);
    const mode = r.mode === "human" ? "human" : "ai";
    return {
      chatId: String(r.id),
      buyerName: String(one(r.profiles)?.display_name ?? "ลูกค้า"),
      status: activeChatStatus(mode, recent),
      preview: chatPreview(recent),
      at: recent.at(-1)?.at ?? new Date(String(r.updated_at)).toISOString(),
    };
  });
}

