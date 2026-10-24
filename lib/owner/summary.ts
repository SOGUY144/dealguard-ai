// ตัวเลขหน้าเถ้าแก่ (Owner-Desktop / Owner-Mobile) — คำนวณจากออเดอร์ที่ปิดได้ ไม่ใช่จากข้อเสนอทั้งหมด
// "กำไรที่รักษาไว้" = เทียบกับถ้ายอมลดตามที่ลูกค้าขอ (SKILL §6.5) ไม่ใช่กำไรทั้งหมดที่เกิดจาก AI
import type { HandoffKind } from "@/lib/chat/replies";
import type { ChatMessage, Offer } from "@/lib/chat/types";
import { bangkokDayStart as bangkokDayStartOf, formatBaht, thaiDate as thaiDateOf } from "@/lib/format";

/** ดีลที่ปิดได้ 1 ดีล — มีตัวเลขหลังบ้าน แสดงได้เฉพาะหน้าเถ้าแก่ */
export type OwnerDeal = {
  id: string;
  /** แชตของดีลนี้ (ลิงก์ไปดูแชต) */
  chatId?: string;
  at: string;
  buyerName: string;
  productName: string;
  offer: Offer;
  marginIfConceded: number;
  marginOffer: number;
  recoveredMargin: number;
};

export type OwnerEscalation = {
  id: string;
  chatId: string;
  kind: HandoffKind;
  /** Deal Brief 3 บรรทัด */
  brief: string[];
  at: string;
};

/** เรื่องในหน้ารอตัดสิน (ทุกวัน) */
export type EscalationEntry = OwnerEscalation & { status: "open" | "resolved"; buyerName: string };

export type OwnerTotals = { recoveredTotal: number; revenueTotal: number; dealCount: number };

export function summarize(deals: OwnerDeal[]): OwnerTotals {
  return {
    recoveredTotal: Math.round(deals.reduce((sum, d) => sum + d.recoveredMargin, 0)),
    revenueTotal: deals.reduce((sum, d) => sum + d.offer.total, 0),
    dealCount: deals.length,
  };
}

// วันตามเวลาไทยใช้ร่วมกับหน้าแชต — อยู่ที่ lib/format
export { bangkokDayStart, thaiDate } from "@/lib/format";

const CHART_STEP = 10_000;

/** ค่าสูงสุดของแกนกราฟ: หลักหมื่นถัดไปที่มากกว่าค่าสูงสุด (แท่งสูงสุดไม่ชนขอบ) */
export function chartMax(values: number[]): number {
  const top = Math.max(0, ...values);
  return Math.max(CHART_STEP, (Math.floor(top / CHART_STEP) + 1) * CHART_STEP);
}

const LABEL: Record<HandoffKind, string> = {
  over_value: "เกินเกณฑ์มูลค่า",
  refund: "ขอคืนเงิน",
  complaint: "ร้องเรียน",
  below_floor_3x: "ขอต่ำกว่าราคาพื้น 3 รอบ",
  injection: "พยายามหลอกระบบ",
  buyer_request: "ลูกค้าขอคุยกับคน",
};

export function escalationLabel(kind: HandoffKind): string {
  return LABEL[kind];
}

/** อักษรย่อใน avatar เช่น "เฮียชัย" → "ชัย" */
export function ownerInitials(displayName: string): string {
  const name = displayName.trim().replace(/^(เฮีย|คุณ)/, "");
  return name.slice(0, 3) || "ร้าน";
}

/** แชตหนึ่งห้องในกล่อง "แชตที่กำลังคุย" (ไม่มีในไฟล์ดีไซน์ — ทีมขอเพิ่ม 24 ต.ค. 2569) */
export type ActiveChat = {
  chatId: string;
  buyerName: string;
  status: ActiveChatStatus;
  preview: string;
  at: string;
};

/** owner = AI หยุดตอบ เถ้าแก่ดูแล · ordered = ข้อความล่าสุดคือปิดดีล · ai = AI กำลังคุย */
export type ActiveChatStatus = "owner" | "ordered" | "ai";

const lastReal = (messages: ChatMessage[]) => messages.findLast((m) => m.type !== "system");

export function activeChatStatus(mode: "ai" | "human", messages: ChatMessage[]): ActiveChatStatus {
  if (mode === "human") return "owner";
  return lastReal(messages)?.type === "order_summary" ? "ordered" : "ai";
}

/** ข้อความล่าสุดแบบสั้นสำหรับแถวในรายการ */
export function chatPreview(messages: ChatMessage[]): string {
  const m = lastReal(messages);
  switch (m?.type) {
    case undefined:
      return "";
    case "buyer_text":
      return m.text;
    case "ai_text":
      return `AI: ${m.text}`;
    case "ai_voice":
      return `AI: ${m.transcript}`;
    case "owner_text":
      return `คุณ: ${m.text}`;
    case "product_card":
      return `เลือก ${m.name}`;
    case "offers":
      return `AI เสนอ ${m.offers.length} ทาง`;
    case "order_summary":
      return `ปิดดีล ข้อ ${m.offer.id} · ${formatBaht(m.offer.total)}`;
    case "handoff":
      return `ส่งเรื่องให้เถ้าแก่ · ${m.subject}`;
  }
}


// ───────────────────────── หน้าดีลทั้งหมด ─────────────────────────

export const DEAL_RANGES = { today: "วันนี้", "7d": "7 วัน", "30d": "30 วัน", all: "ทั้งหมด" } as const;
export type DealRange = keyof typeof DEAL_RANGES;

export function parseDealRange(value: unknown): DealRange {
  // hasOwn ไม่ใช่ in — "?range=toString" / "constructor" ต้องไม่ผ่าน (หน้าพัง)
  return typeof value === "string" && Object.hasOwn(DEAL_RANGES, value) ? (value as DealRange) : "all";
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** วันแรกของช่วง (นับรวมวันนี้ เวลาไทย) · ทั้งหมด = null */
export function dealRangeStart(range: DealRange, now: Date): Date | null {
  const days = { today: 1, "7d": 7, "30d": 30, all: 0 }[range];
  if (!days) return null;
  return new Date(bangkokDayStartOf(now).getTime() - (days - 1) * DAY_MS);
}

/** ดีลแยกตามวัน (เวลาไทย) วันใหม่ก่อน ในวันเดียวกันล่าสุดก่อน */
export function groupDealsByDay(deals: OwnerDeal[]): { label: string; deals: OwnerDeal[] }[] {
  const groups = new Map<number, OwnerDeal[]>();
  for (const d of [...deals].sort((a, b) => b.at.localeCompare(a.at))) {
    const key = bangkokDayStartOf(new Date(d.at)).getTime();
    groups.set(key, [...(groups.get(key) ?? []), d]);
  }
  return [...groups].map(([key, list]) => ({ label: thaiDateOf(new Date(key)), deals: list }));
}
