import "server-only";
import { formatQty } from "@/lib/format";
import { buildBrief, type BriefContext } from "./escalation";
import { assertOffersSafe } from "./guard";
import { computeEconomics } from "./margin";
import { buildOffers } from "./offers";
import type { EngineInput, EngineResult, EscalationKind, PricedOffer, Product } from "./types";

/** จำนวนต้องเป็นจำนวนเต็มบวก — นอกนั้นถือว่ายังไม่รู้จำนวน */
const validQty = (n: number | null): number | null => (n !== null && Number.isInteger(n) && n > 0 ? n : null);

/** ราคาต้องเป็นตัวเลขบวก แล้วปัดขึ้นเป็นบาทเต็ม (ราคาที่แสดงกับยอดรวมจะได้ตรงกัน) */
const validPrice = (n: number | null): number | null => (n !== null && Number.isFinite(n) && n > 0 ? Math.ceil(n) : null);

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

  const qty = validQty(intent.quantity);
  if (!qty) return { kind: "ask_quantity", sku: product.sku, state };

  const requested = validPrice(intent.requestedPrice);
  // ประเมินมูลค่าที่ราคาพื้นเป็นอย่างต่ำ — ขอราคาต่ำมากจะหลบเกณฑ์ escalate ไม่ได้
  const valuePrice = Math.max(requested ?? product.listPrice, product.floorPrice);
  const overValue = () =>
    escalate("over_value", {
      product,
      qty,
      price: requested,
      value: qty * valuePrice,
      valueBasis: requested === null ? "list" : requested < product.floorPrice ? "floor" : "requested",
    });
  if (qty * valuePrice > config.escalationDealValue) return overValue();

  // ขอเท่าราคาขายขึ้นไป หรือสั่งซื้อโดยไม่ต่อราคา → ไม่ต้องลด
  const acceptsList = requested !== null ? requested >= product.listPrice : intent.intent === "order";
  if (acceptsList) return { kind: "accept_list", offer: listOffer(input, product, qty), state };

  // นับเฉพาะรอบที่ขอต่ำกว่าพื้น "ติดกัน" — ขอราคาที่รับได้คั่นแล้วเริ่มนับใหม่
  const belowFloor = requested !== null && requested < product.floorPrice;
  state = { ...state, belowFloorCount: belowFloor ? state.belowFloorCount + 1 : 0 };
  if (state.belowFloorCount >= 3) return escalate("below_floor_3x", { product, qty, price: requested });

  // ข้อเสนอที่ยอดรวมเกินเกณฑ์ escalate ถือว่าเกินอำนาจของ AI
  const { offers, droppedOverLimit } = buildOffers(product, config, {
    requestedPrice: requested,
    qty,
    maxTotal: config.escalationDealValue,
  });
  if (offers.length === 0) {
    // ทุกทางเกินอำนาจ → ให้เถ้าแก่ตัดสิน · ลดไม่ได้เลย (เช่น พื้น = ราคาขาย) → ขายราคาปกติ
    return droppedOverLimit > 0 ? overValue() : { kind: "accept_list", offer: listOffer(input, product, qty), state };
  }
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
