// กฎของคำตอบให้ลูกค้า (เรื่องส่งของ / สต๊อก) ที่เถ้าแก่กรอกเอง — ใช้ทั้งหน้าจอและ server
// ผู้ช่วยตอบลูกค้าด้วยข้อความนี้ตรงตัว จึงต้องสั้นพอให้อ่านในแชตได้ และไม่มีตัวอักษรแปลกที่วางมาจากที่อื่น
import { z } from "zod";
import type { ShopAnswers } from "@/lib/deal-engine/types";
import type { FieldErrors } from "./product-settings";

export type { ShopAnswers } from "@/lib/deal-engine/types";

export const SHOP_ANSWER_MAX = 300;

export const shopAnswersSchema = z.object({ delivery: z.string().max(2000), stock: z.string().max(2000) });

/** ขึ้นบรรทัดใหม่ → เว้นวรรค (ฟองแชตแสดงบรรทัดเดียวต่อกัน) · ลบตัวอักษรควบคุม · ตัดช่องว่างหัวท้าย */
export function cleanShopAnswers(a: ShopAnswers): ShopAnswers {
  const clean = (s: string) => s.replace(/[\r\n\t]+/g, " ").replace(/[\u0000-\u001f\u007f]/g, "").replace(/ {2,}/g, " ").trim();
  return { delivery: clean(a.delivery), stock: clean(a.stock) };
}

/** ตรวจหลังล้างแล้ว · ว่างได้ (= ผู้ช่วยบอกลูกค้าว่ายังตอบเรื่องนั้นไม่ได้) */
export function validateShopAnswers(a: ShopAnswers): FieldErrors {
  const errors: FieldErrors = {};
  for (const key of ["delivery", "stock"] as const) {
    if (a[key].length > SHOP_ANSWER_MAX) errors[key] = `ไม่เกิน ${SHOP_ANSWER_MAX} ตัวอักษร`;
  }
  return errors;
}
