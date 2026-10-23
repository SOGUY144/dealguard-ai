import { buildBrief, type BriefContext } from "./escalation";
import { formatQty } from "@/lib/format";
import { assertOffersSafe } from "./guard";
import { computeEconomics } from "./margin";
import { buildOffers } from "./offers";
import type { EngineInput, EngineResult, EscalationKind, PricedOffer, Product } from "./types";

/**
 * Layer 2: ตัดสินจาก Intent ด้วยโค้ดล้วน (SKILL §6.4) — ลำดับการเช็กสำคัญ:
 * เรื่องที่ต้องให้คน → การหลอกระบบ → ข้อมูลไม่พอ → เกินอำนาจ → ราคา
 */
export function runDealEngine(input: EngineInput): EngineResult {
  const { config, intent, buyerName, messageText } = input;
  let state = input.state;

  const escalate = (reason: EscalationKind, ctx: Partial<BriefContext> = {}): EngineResult => ({
    kind: "escalate",
    reason,
    brief: buildBrief(reason, { config, buyerName, messageText, ...ctx }),
    state,
  });

  if (intent.intent === "refund" || intent.intent === "complaint") return escalate(intent.intent);

  if (intent.injectionSuspected) {
    state = { ...state, injectionCount: state.injectionCount + 1 };
    return state.injectionCount >= 2 ? escalate("injection") : { kind: "guard", state };
  }

  if (intent.intent !== "negotiate_price" && intent.intent !== "order") return { kind: "not_negotiation", state };

  const product = config.products.find((p) => p.sku === intent.sku);
  if (!product) return { kind: "ask_product", state };

  const qty = intent.quantity;
  if (!qty) return { kind: "ask_quantity", sku: product.sku, state };

  const requested = intent.requestedPrice;
  const askedValue = qty * (requested ?? product.listPrice);
  if (askedValue > config.escalationDealValue) {
    return escalate("over_value", { product, qty, price: requested ?? product.listPrice });
  }

  // ขอเท่าราคาขายขึ้นไป หรือสั่งซื้อโดยไม่ต่อราคา → ไม่ต้องลด
  const acceptsList = requested !== null ? requested >= product.listPrice : intent.intent === "order";
  if (acceptsList) return { kind: "accept_list", offer: listOffer(input, product, qty), state };

  if (requested !== null && requested < product.floorPrice) {
    state = { ...state, belowFloorCount: state.belowFloorCount + 1 };
    if (state.belowFloorCount >= 3) return escalate("below_floor_3x", { product, qty, price: requested });
  }

  // ข้อเสนอที่ยอดรวมเกินเกณฑ์ escalate ถือว่าเกินอำนาจของ AI
  const offers = buildOffers(product, config, {
    requestedPrice: requested,
    qty,
    maxTotal: config.escalationDealValue,
  });
  assertOffersSafe(product, qty, offers.map((p) => p.offer));
  return { kind: "offers", offers, state };
}

/** ขายราคาปกติ — baseline คือราคาขาย จึงไม่มีกำไรที่ "รักษาไว้" เพิ่ม */
function listOffer(input: EngineInput, product: Product, qty: number): PricedOffer {
  const offer = {
    id: "A" as const,
    lever: "list" as const,
    label: "ราคาปกติ",
    pricePerUnit: product.listPrice,
    qty,
    conditionText: `${formatQty(qty)} ชิ้น · เครดิต ${product.defaultCreditDays} วัน`,
    total: product.listPrice * qty,
    creditDays: product.defaultCreditDays,
  };
  assertOffersSafe(product, qty, [offer]);
  return {
    offer,
    economics: computeEconomics(product, input.config, { referencePrice: product.listPrice, qty }, offer),
  };
}
