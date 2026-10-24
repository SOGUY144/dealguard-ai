// ราคาที่เถ้าแก่อนุมัติเอง (หน้าแชตเถ้าแก่) — ใช้ได้ทั้ง server และ browser จึงห้ามมีต้นทุน/ราคาพื้น
import type { Offer } from "@/lib/deal-engine/types";

/** ป้ายของข้อเสนอที่เถ้าแก่อนุมัติ — AI ไม่เคยสร้างป้ายนี้ (ราคาปกติของ AI ใช้ "ราคาปกติ") */
export const OWNER_APPROVED_LABEL = "ราคาที่เถ้าแก่อนุมัติ";

/** เงื่อนไขการจ่ายที่เถ้าแก่เลือกได้ (วัน) — 0 = โอนทันที */
export const OWNER_CREDIT_CHOICES = [0, 7, 15, 30] as const;

/**
 * ข้อเสนอนี้เถ้าแก่อนุมัติเองหรือไม่ — เถ้าแก่ตัดสินแล้ว จึงไม่ต้องผ่านราคาพื้น/เกณฑ์มูลค่าดีลของ AI อีก
 * (ข้อเสนอจาก AI ใช้ lever "list" ได้เฉพาะ "ราคาปกติ" เท่านั้น)
 */
export function isOwnerApproved(offer: Pick<Offer, "lever" | "label">): boolean {
  return offer.lever === "list" && offer.label === OWNER_APPROVED_LABEL;
}
