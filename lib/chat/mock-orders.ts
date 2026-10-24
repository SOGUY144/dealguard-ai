// ออเดอร์เดโมของเฟส 2 (ยังไม่มีฐานข้อมูล) — เฟส 5 จะอ่านจากตาราง deals แทน
import { MOCK_OFFERS } from "./mock-offers";
import type { Offer } from "./types";

/** confirmedAt = เวลาที่ร้านยืนยันออเดอร์ (null = รอร้านยืนยัน ยังไม่มี QR) · paidAt = เวลาที่ร้านยืนยันว่าได้รับเงิน */
export type OrderView = { id: string; offer: Offer; productName: string; at: string; confirmedAt: string | null; paidAt: string | null };

export const MOCK_ORDER_IDS = MOCK_OFFERS.map((o) => `demo-${o.id}`);

export function getMockOrder(id: string): OrderView | undefined {
  const offer = MOCK_OFFERS.find((o) => `demo-${o.id}` === id);
  if (!offer) return undefined;
  // 21:33 เวลาไทย เหมือนในดีไซน์ · ถือว่าร้านยืนยันแล้ว หน้าเดโมจึงเห็น QR
  const at = "2026-10-23T14:33:00Z";
  return { id, offer, productName: "สายชาร์จ Type-C 1 เมตร", at, confirmedAt: at, paidAt: null };
}
