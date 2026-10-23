// ออเดอร์เดโมของเฟส 2 (ยังไม่มีฐานข้อมูล) — เฟส 5 จะอ่านจากตาราง deals แทน
import { MOCK_OFFERS } from "./mock-offers";
import type { Offer } from "./types";

export type OrderView = { id: string; offer: Offer; productName: string; at: string };

export const MOCK_ORDER_IDS = MOCK_OFFERS.map((o) => `demo-${o.id}`);

export function getMockOrder(id: string): OrderView | undefined {
  const offer = MOCK_OFFERS.find((o) => `demo-${o.id}` === id);
  if (!offer) return undefined;
  // 21:33 เวลาไทย เหมือนในดีไซน์
  return { id, offer, productName: "สายชาร์จ Type-C 1 เมตร", at: "2026-10-23T14:33:00Z" };
}
