// อ่านข้อมูลหน้าเถ้าแก่ด้วย client ของผู้ใช้ (RLS) — ตาราง margin / escalations อ่านได้เฉพาะ owner
// ถ้าคนที่ไม่ใช่ owner เรียก จะได้ตัวเลข margin ว่าง (ไม่ใช่ข้อมูลของร้าน) แต่หน้า /owner เช็ก requireOwner ก่อนเสมอ
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { HandoffKind } from "@/lib/chat/replies";
import { toOffer } from "@/lib/chat-server/supabase-store";
import { bangkokDayStart, type OwnerDeal, type OwnerEscalation } from "./summary";

type Row = Record<string, unknown>;

/** embed แบบหนึ่งต่อหนึ่ง PostgREST อาจคืนเป็น object หรือ array ตามความสัมพันธ์ */
const one = (v: unknown): Row | null => (Array.isArray(v) ? ((v[0] as Row) ?? null) : ((v as Row) ?? null));

/** รายการเรื่องรอตัดสินที่แสดงได้มากสุด (จำนวนจริงนับแยก) */
const ESCALATION_LIST_LIMIT = 20;

export type OwnerData = {
  deals: OwnerDeal[];
  escalations: OwnerEscalation[];
  /** จำนวนเรื่องรอตัดสินของวันนี้ตามจริง (รายการอาจตัดไว้ที่ ESCALATION_LIST_LIMIT) */
  openCount: number;
  /** ออเดอร์ที่อ่าน margin ไม่ได้ (ข้อมูลไม่ครบ) — ควรเป็น 0 เสมอ */
  incompleteDeals: number;
};

export async function readOwnerData(db: SupabaseClient, now = new Date()): Promise<OwnerData> {
  const since = bangkokDayStart(now).toISOString();
  // เรื่องที่ยังไม่ปิดของวันนี้ — ของวันก่อนไม่ค้างกองบนหน้า (ปิดเรื่องได้ในหน้าแชตเถ้าแก่ เฟส 8)
  const openToday = () =>
    db.from("escalations").select("id, chat_id, kind, brief, created_at", { count: "exact" }).eq("status", "open").gte("created_at", since);
  const [orders, escalations] = await Promise.all([
    db
      .from("orders")
      // เฉพาะออเดอร์ของบัญชีลูกค้า — เถ้าแก่/กรรมการลองสั่งเองจากหน้าลูกค้าไม่นับเป็นดีลของ AI
      .select("id, created_at, product_name, profiles!inner(display_name, role), offers(*, offer_economics(*))")
      .eq("profiles.role", "buyer")
      .gte("created_at", since)
      .order("created_at"),
    openToday().order("created_at", { ascending: false }).limit(ESCALATION_LIST_LIMIT),
  ]);
  if (orders.error) throw new Error(`[owner] อ่านออเดอร์: ${orders.error.message}`);
  if (escalations.error) throw new Error(`[owner] อ่านเรื่องที่ส่งต่อ: ${escalations.error.message}`);

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
      at: new Date(String(row.created_at)).toISOString(),
      buyerName: String(one(row.profiles)?.display_name ?? "ลูกค้า"),
      productName: String(row.product_name),
      offer: toOffer(offerRow),
      marginIfConceded: Number(econ.margin_if_conceded),
      marginOffer: Number(econ.margin_offer),
      recoveredMargin: Number(econ.recovered_margin),
    });
  }

  return {
    deals,
    incompleteDeals,
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
