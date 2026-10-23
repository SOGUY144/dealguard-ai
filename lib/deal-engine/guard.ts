import type { Offer, Product } from "./types";

export class UnsafeOfferError extends Error {}

/**
 * ด่านสุดท้ายก่อนข้อเสนอออกจากระบบ (SKILL §6.4 ข้อ 1–2) — ไม่มีข้อยกเว้น
 * โยน error แทนการแก้ตัวเลขเอง เพราะข้อเสนอที่ผิดแปลว่าโค้ดสร้างข้อเสนอมีบั๊ก
 */
export function assertOffersSafe(product: Product, requestedQty: number, offers: Offer[]): void {
  for (const offer of offers) {
    if (offer.pricePerUnit < product.floorPrice) {
      throw new UnsafeOfferError(
        `Floor Guard: ${offer.id} ราคา ${offer.pricePerUnit} ต่ำกว่าราคาพื้น ${product.floorPrice}`,
      );
    }
    if (!hasTradeOff(product, requestedQty, offer)) {
      throw new UnsafeOfferError(`No Free Concession: ${offer.id} (${offer.lever}) ลดราคาโดยไม่มีเงื่อนไขแลก`);
    }
  }
}

function hasTradeOff(product: Product, requestedQty: number, offer: Offer): boolean {
  switch (offer.lever) {
    case "list":
      return offer.pricePerUnit === product.listPrice;
    case "volume":
      return offer.qty > requestedQty;
    case "cash":
      return offer.creditDays === 0;
    case "bundle":
      return (offer.bundle?.qty ?? 0) > 0;
  }
}
