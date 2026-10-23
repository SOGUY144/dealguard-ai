import type { MerchantConfig, OfferEconomics, Product } from "./types";

/** สิ่งที่ลูกค้าขอ: ราคาที่ใช้เป็น baseline (ราคาที่ขอ หรือราคาขายถ้าไม่ได้บอก) และจำนวน */
export type RequestBasis = { referencePrice: number; qty: number };

export type OfferTerms = { pricePerUnit: number; qty: number; creditDays: number };

export type GiftCost = { unitCost: number; qty: number };

// สูตร SKILL §6.5 — เทียบกับ "ถ้ายอมลดตามที่ขอ" ไม่ใช่กำไรที่เกิดจาก AI ทั้งหมด
export function computeEconomics(
  product: Product,
  config: MerchantConfig,
  request: RequestBasis,
  terms: OfferTerms,
  gift?: GiftCost,
): OfferEconomics {
  const marginIfConceded = (request.referencePrice - product.unitCost) * request.qty;
  const bundleCost = gift ? gift.unitCost * gift.qty : 0;
  const creditDaysSaved = Math.max(0, product.defaultCreditDays - terms.creditDays);
  const cashValue =
    terms.pricePerUnit * terms.qty * (creditDaysSaved / 365) * config.costOfCapitalAnnual;
  const marginOffer = (terms.pricePerUnit - product.unitCost) * terms.qty - bundleCost + cashValue;

  return {
    marginIfConceded,
    marginOffer,
    recoveredMargin: marginOffer - marginIfConceded,
    bundleCost,
    cashValue,
  };
}
