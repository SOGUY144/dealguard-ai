import "server-only";
import { formatQty, roundSatang } from "@/lib/format";
import { computeEconomics, type GiftCost, type RequestBasis } from "./margin";
import type { MerchantConfig, Offer, PricedOffer, Product } from "./types";

export type OfferRequest = {
  /** ราคาต่อชิ้นที่ลูกค้าขอ (engine ปัดขึ้นเป็นสตางค์ก่อนส่งมา) */
  requestedPrice: number | null;
  qty: number;
  /** ตัดข้อเสนอที่ยอดรวมเกินนี้ทิ้ง (ก่อนไล่ id) */
  maxTotal?: number;
  /** ทางเลือกที่ลูกค้าปฏิเสธแล้ว — ไม่สร้างข้อนั้น */
  excludeLevers?: Offer["lever"][];
};

export type BuiltOffers = {
  offers: PricedOffer[];
  /** จำนวนข้อเสนอที่ถูกตัดเพราะยอดรวมเกินอำนาจ AI */
  droppedOverLimit: number;
  /** ยอดรวมของข้อที่ถูกที่สุดที่ถูกตัด (ใช้เขียน Deal Brief) */
  minDroppedTotal: number | null;
};

type Draft = Omit<Offer, "id">;

/**
 * หน่วยปัดราคาของสินค้า: ร้านตั้งราคาเป็นบาทเต็ม → ข้อเสนอเป็นบาทเต็ม (฿145 ไม่ใช่ ฿145.40)
 * มีสตางค์ในราคาขาย/พื้น/ขั้นราคา (เช่น ฿9.50) → ปัดเป็นสตางค์ ไม่งั้นต่อราคาไม่ได้เลย
 */
export function priceStep(product: Product): 1 | 0.01 {
  const prices = [product.listPrice, product.floorPrice, ...product.volumeTiers.map((t) => t.price)];
  return prices.every(Number.isInteger) ? 1 : 0.01;
}

export function roundPrice(n: number, product: Product): number {
  return priceStep(product) === 1 ? Math.round(n) : roundSatang(n);
}

const IDS: Offer["id"][] = ["A", "B", "C"];

/** สร้างข้อเสนอ ซื้อเยอะ / จ่ายสด / รับของแถม (SKILL §6.4 ข้อ 3) — ตัวไหนทำไม่ได้ก็ข้าม แล้วไล่ id ใหม่ */
export function buildOffers(product: Product, config: MerchantConfig, request: OfferRequest): BuiltOffers {
  // baseline ของกำไร = ยอมลดตามที่ขอ (ไม่บอกราคา = ขายราคาเต็ม)
  // แต่ไม่ต่ำกว่าราคาพื้น: AI ลดต่ำกว่าพื้นไม่ได้อยู่แล้ว ขอต่ำมากจึงไม่ควรทำให้ "กำไรที่รักษาไว้" พองเกินจริง
  const basis: RequestBasis = {
    referencePrice: Math.min(product.listPrice, Math.max(product.floorPrice, request.requestedPrice ?? product.listPrice)),
    qty: request.qty,
  };
  // ราคาขั้นต่ำที่ลูกค้ายอมจ่ายเอง — ไม่เสนอต่ำกว่านี้
  const askedPrice = request.requestedPrice ?? 0;

  const drafts: { draft: Draft; gift?: GiftCost }[] = [];

  const volume = volumeOffer(product, request.qty, askedPrice);
  if (volume) drafts.push({ draft: volume });

  const cashPrice = Math.max(
    product.floorPrice,
    roundPrice(product.listPrice * (1 - product.cashDiscountPct), product),
    askedPrice,
  );
  // สินค้าที่ปกติโอนทันทีอยู่แล้ว ลูกค้าไม่ได้เสียเครดิตแลก → ลดให้ = ลดฟรี
  if (cashPrice < product.listPrice && product.defaultCreditDays > 0) {
    drafts.push({
      draft: {
        lever: "cash",
        label: "จ่ายสด",
        pricePerUnit: cashPrice,
        qty: request.qty,
        conditionText: `${formatQty(request.qty)} ชิ้น · โอนทันที ไม่ใช้เครดิต`,
        total: roundSatang(cashPrice * request.qty),
        creditDays: 0,
      },
    });
  }

  // ของแถมชดเชยส่วนต่างกับราคาจ่ายสด — ไม่มีส่วนลดจ่ายสด (0%) หรือส่วนลดจ่ายสดน้อยจนราคาจ่ายสดสูงกว่าข้อของแถม (เช่น 2%)
  // → เทียบกับราคาที่ลูกค้าขอแทน ไม่งั้นข้อนี้หายไปด้วย
  const bundle = bundleOffer(product, config, request, {
    cashPrice: cashPrice < product.listPrice ? cashPrice : null,
    fallback: Math.max(product.floorPrice, request.requestedPrice ?? product.floorPrice),
  });
  if (bundle) drafts.push(bundle);

  const maxTotal = request.maxTotal ?? Infinity;
  // กำไรทั้งดีล (หลังหักทุนของแถม) ต้องไม่ต่ำกว่ากำไรที่ราคาพื้น — ราคาต่อชิ้นผ่านพื้นแต่แถมเยอะจนกำไรรวมหลุดก็ไม่เสนอ
  const excluded = new Set(request.excludeLevers ?? []);
  const allowed = drafts.filter(
    ({ draft, gift }) =>
      !excluded.has(draft.lever) &&
      draft.total <= maxTotal && keepsFloorMargin(product, computeEconomics(product, config, basis, draft, gift).marginOffer, draft.qty),
  );
  const dropped = drafts.filter(({ draft }) => !excluded.has(draft.lever) && draft.total > maxTotal).map(({ draft }) => draft.total);
  return {
    droppedOverLimit: dropped.length,
    minDroppedTotal: dropped.length ? Math.min(...dropped) : null,
    offers: allowed.map(({ draft, gift }, i) => {
      const offer: Offer = { id: IDS[i], ...draft };
      const economics = computeEconomics(product, config, basis, offer, gift);
      // ทีมตัดสิน 24 ต.ค. 2569: ไม่ได้ขอราคา = ไม่มีอะไรที่ "ยอมลด" ไป → กำไรที่รักษาไว้เป็น 0 (ไม่ติดลบ)
      if (request.requestedPrice === null) {
        return { offer, economics: { ...economics, marginIfConceded: economics.marginOffer, recoveredMargin: 0 } };
      }
      return { offer, economics };
    }),
  };
}

/**
 * กำไรรวมของข้อเสนอต้องไม่ต่ำกว่า "ขายที่ราคาพื้น" ในจำนวนเท่ากัน (เผื่อปัดเศษ 1 สตางค์)
 * ราคาพื้นคือเส้นที่เถ้าแก่ตั้งไว้ — ของแถมหรือเงื่อนไขอื่นต้องไม่ทำให้ดีลทั้งก้อนต่ำกว่าเส้นนั้น
 */
export function keepsFloorMargin(product: Product, marginOffer: number, qty: number): boolean {
  return marginOffer >= (product.floorPrice - product.unitCost) * qty - 0.01;
}

/** tier ที่เล็กที่สุดซึ่งมากกว่าจำนวนที่ขอ ไม่ต่ำกว่าราคาพื้น และถูกกว่าราคาขาย (เท่าราคาขาย = ซื้อเพิ่มโดยไม่ได้อะไร) */
function volumeOffer(product: Product, qty: number, askedPrice: number): Draft | null {
  const tier = [...product.volumeTiers]
    .sort((a, b) => a.minQty - b.minQty)
    .find((t) => t.minQty > qty && t.price >= product.floorPrice && t.price < product.listPrice);
  if (!tier) return null;

  const price = Math.max(tier.price, askedPrice);
  return {
    lever: "volume",
    label: "ซื้อเยอะ",
    pricePerUnit: price,
    qty: tier.minQty,
    conditionText: `เมื่อสั่ง ${formatQty(tier.minQty)} ชิ้น`,
    total: roundSatang(price * tier.minQty),
    creditDays: product.defaultCreditDays,
  };
}

/**
 * ราคา = ราคาขาย − bundleConcessionRatio × ส่วนที่ขอลด (ไม่บอกราคา = ขอที่ราคาพื้น)
 * จำนวนแถม = ให้มูลค่าที่ลูกค้ารู้สึกชดเชยส่วนต่างกับราคาจ่ายสด ไม่เกินสต๊อก
 */
function bundleOffer(
  product: Product,
  config: MerchantConfig,
  request: OfferRequest,
  /** ราคาที่ใช้เทียบว่าของแถมต้องชดเชยเท่าไหร่: ราคาจ่ายสดถ้าถูกกว่าข้อนี้ ไม่งั้นราคาที่ลูกค้าขอ (ไม่ต่ำกว่าพื้น) */
  anchor: { cashPrice: number | null; fallback: number },
): { draft: Draft; gift: GiftCost } | null {
  const stock = config.deadStock.find((d) => d.qtyAvailable > 0 && d.perceivedValue > 0);
  if (!stock) return null;

  const reference = request.requestedPrice ?? product.floorPrice;
  const price = Math.max(
    product.floorPrice,
    roundPrice(product.listPrice - config.bundleConcessionRatio * (product.listPrice - reference), product),
  );
  const anchorPrice = anchor.cashPrice !== null && anchor.cashPrice < price ? anchor.cashPrice : anchor.fallback;
  const giftQty = Math.min(
    stock.qtyAvailable,
    Math.floor((request.qty * (price - anchorPrice)) / stock.perceivedValue),
  );
  // ราคาเท่าราคาขาย + ของแถม = ให้ของฟรีโดยลูกค้าไม่ได้แลกอะไร
  if (giftQty <= 0 || price >= product.listPrice) return null;

  // ต้นทุนของแถมต้องน้อยกว่าเงินที่ไม่ได้ลดให้ (SKILL §6.4)
  const giftCost = stock.unitCost * giftQty;
  if (giftCost >= (price - reference) * request.qty) return null;

  return {
    draft: {
      lever: "bundle",
      label: "รับของแถม",
      pricePerUnit: price,
      qty: request.qty,
      conditionText: `${formatQty(request.qty)} ชิ้น + ${stock.name} ${formatQty(giftQty)} ชิ้น`,
      total: roundSatang(price * request.qty),
      creditDays: product.defaultCreditDays,
      bundle: { sku: stock.sku, name: stock.name, qty: giftQty },
    },
    gift: { unitCost: stock.unitCost, qty: giftQty },
  };
}
