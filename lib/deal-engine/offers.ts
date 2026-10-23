import "server-only";
import { formatQty } from "@/lib/format";
import { computeEconomics, type GiftCost, type RequestBasis } from "./margin";
import type { MerchantConfig, Offer, PricedOffer, Product } from "./types";

export type OfferRequest = {
  /** ราคาต่อชิ้นที่ลูกค้าขอ (engine ปัดขึ้นเป็นบาทเต็มก่อนส่งมา) */
  requestedPrice: number | null;
  qty: number;
  /** ตัดข้อเสนอที่ยอดรวมเกินนี้ทิ้ง (ก่อนไล่ id) */
  maxTotal?: number;
};

export type BuiltOffers = {
  offers: PricedOffer[];
  /** จำนวนข้อเสนอที่ถูกตัดเพราะยอดรวมเกินอำนาจ AI */
  droppedOverLimit: number;
};

type Draft = Omit<Offer, "id">;

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
    Math.round(product.listPrice * (1 - product.cashDiscountPct)),
    askedPrice,
  );
  if (cashPrice < product.listPrice) {
    drafts.push({
      draft: {
        lever: "cash",
        label: "จ่ายสด",
        pricePerUnit: cashPrice,
        qty: request.qty,
        conditionText: `${formatQty(request.qty)} ชิ้น · โอนทันที ไม่ใช้เครดิต`,
        total: cashPrice * request.qty,
        creditDays: 0,
      },
    });
  }

  const bundle = bundleOffer(product, config, request, cashPrice);
  if (bundle) drafts.push(bundle);

  const maxTotal = request.maxTotal ?? Infinity;
  const allowed = drafts.filter(({ draft }) => draft.total <= maxTotal);
  return {
    droppedOverLimit: drafts.length - allowed.length,
    offers: allowed.map(({ draft, gift }, i) => {
      const offer: Offer = { id: IDS[i], ...draft };
      return { offer, economics: computeEconomics(product, config, basis, offer, gift) };
    }),
  };
}

/** tier ที่เล็กที่สุดซึ่งมากกว่าจำนวนที่ขอ และไม่ต่ำกว่าราคาพื้น */
function volumeOffer(product: Product, qty: number, askedPrice: number): Draft | null {
  const tier = [...product.volumeTiers]
    .sort((a, b) => a.minQty - b.minQty)
    .find((t) => t.minQty > qty && t.price >= product.floorPrice);
  if (!tier) return null;

  const price = Math.max(tier.price, askedPrice);
  return {
    lever: "volume",
    label: "ซื้อเยอะ",
    pricePerUnit: price,
    qty: tier.minQty,
    conditionText: `เมื่อสั่ง ${formatQty(tier.minQty)} ชิ้น`,
    total: price * tier.minQty,
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
  cashPrice: number,
): { draft: Draft; gift: GiftCost } | null {
  const stock = config.deadStock.find((d) => d.qtyAvailable > 0 && d.perceivedValue > 0);
  if (!stock) return null;

  const reference = request.requestedPrice ?? product.floorPrice;
  const price = Math.max(
    product.floorPrice,
    Math.round(product.listPrice - config.bundleConcessionRatio * (product.listPrice - reference)),
  );
  const giftQty = Math.min(
    stock.qtyAvailable,
    Math.floor((request.qty * (price - cashPrice)) / stock.perceivedValue),
  );
  if (giftQty <= 0) return null;

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
      total: price * request.qty,
      creditDays: product.defaultCreditDays,
      bundle: { name: stock.name, qty: giftQty },
    },
    gift: { unitCost: stock.unitCost, qty: giftQty },
  };
}
