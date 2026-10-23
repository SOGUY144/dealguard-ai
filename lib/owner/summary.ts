// ตัวเลขหน้าเถ้าแก่ (Owner-Desktop / Owner-Mobile) — คำนวณจากออเดอร์ที่ปิดได้ ไม่ใช่จากข้อเสนอทั้งหมด
// "กำไรที่รักษาไว้" = เทียบกับถ้ายอมลดตามที่ลูกค้าขอ (SKILL §6.5) ไม่ใช่กำไรทั้งหมดที่เกิดจาก AI
import type { HandoffKind } from "@/lib/chat/replies";
import type { Offer } from "@/lib/chat/types";

/** ดีลที่ปิดได้ 1 ดีล — มีตัวเลขหลังบ้าน แสดงได้เฉพาะหน้าเถ้าแก่ */
export type OwnerDeal = {
  id: string;
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
