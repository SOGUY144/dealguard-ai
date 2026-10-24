// ราคาตามจำนวนที่บอกลูกค้าได้ ตอนยังไม่รู้จำนวน ("ลดได้ไหม", "150 บาทได้เท่าไหร่", "320 บาทได้กี่เส้น")
// ใช้ตัวเลขชุดเดียวกับที่ buildOffers เสนอจริง (ขั้นราคา / จ่ายสด) — ไม่มีราคาพื้นหรือต้นทุนในผลลัพธ์
import "server-only";
import { roundSatang } from "@/lib/format";
import { roundPrice } from "./offers";
import type { Product, VolumeTier } from "./types";

export type PriceGuide = {
  listPrice: number;
  /** ขั้นราคาที่ถูกกว่าราคาขายและไม่ต่ำกว่าพื้น เรียงจากจำนวนน้อยไปมาก */
  tiers: VolumeTier[];
  /** ราคาเมื่อโอนทันที (ทุกจำนวน) · null = สินค้านี้ไม่มีส่วนลดจ่ายสด */
  cashPrice: number | null;
};

export function priceGuide(product: Product): PriceGuide {
  const tiers = product.volumeTiers
    .filter((t) => t.price >= product.floorPrice && t.price < product.listPrice)
    .sort((a, b) => a.minQty - b.minQty)
    .map(({ minQty, price }) => ({ minQty, price }));
  // เหมือนข้อจ่ายสดใน buildOffers: ไม่ต่ำกว่าพื้น · สินค้าที่โอนทันทีอยู่แล้วไม่มีส่วนลด
  const cash = Math.max(product.floorPrice, roundPrice(product.listPrice * (1 - product.cashDiscountPct), product));
  return {
    listPrice: product.listPrice,
    tiers,
    cashPrice: cash < product.listPrice && product.defaultCreditDays > 0 ? cash : null,
  };
}

/** ได้ราคาที่ขอถ้า: ราคาปกติถึงอยู่แล้ว / โอนทันที / สั่งถึงขั้นแรกที่ราคาไม่เกินที่ขอ */
export function reachPrice(guide: PriceGuide, price: number): { atList: boolean; cash: boolean; tier: VolumeTier | null } {
  return {
    atList: guide.listPrice <= price,
    cash: guide.cashPrice !== null && guide.cashPrice <= price,
    tier: guide.tiers.find((t) => t.price <= price) ?? null,
  };
}

/** งบรวมได้กี่ชิ้นมากสุด (ราคาปกติหรือขั้นราคาที่ถึง) · ไม่พอ 1 ชิ้น = null */
export function budgetQty(guide: PriceGuide, budget: number): { qty: number; pricePerUnit: number; total: number } | null {
  let best = { qty: Math.floor(budget / guide.listPrice), pricePerUnit: guide.listPrice };
  for (const t of guide.tiers) {
    const qty = Math.floor(budget / t.price);
    if (qty >= t.minQty && qty > best.qty) best = { qty, pricePerUnit: t.price };
  }
  return best.qty > 0 ? { ...best, total: roundSatang(best.qty * best.pricePerUnit) } : null;
}
