// ตอบต่อจากบทสนทนา — ลูกค้าถามต่อโดยไม่บอกจำนวน ("ลดอีกได้ไหม", "150 บาทได้เท่าไหร่", "320 บาทได้กี่เส้น", "คุยไม่รู้เรื่อง")
// แชตจริง 25 ต.ค. 2569: ทุกกรณีนี้เคยได้ "ราคาส่ง ฿150 ต่อชิ้นครับ ต้องการกี่ชิ้นครับ" วนซ้ำ
// ตัดสินด้วยโค้ด (ตัวเลขจากขั้นราคา/ราคาโอนทันที/การ์ดจริง) แล้วให้ GPT เรียบเรียง — template คือคำตอบสำรองที่ข้อมูลครบ
import "server-only";
import type { ChatTurn, ChatWriterInput } from "@/lib/ai/chat-writer";
import type { ChatMessage, ChatMessageOf, Offer } from "@/lib/chat/types";
import { budgetQty, priceGuide, reachPrice } from "@/lib/deal-engine/price-guide";
import { rejectedLetters, rejectedLevers } from "@/lib/deal-engine/rejections";
import type { Intent, MerchantConfig, Product } from "@/lib/deal-engine/types";
import { formatBaht, formatQty } from "@/lib/format";

/** สิ่งที่ตอบ: template (ใช้ตอน GPT ไม่ได้/ตรวจไม่ผ่าน) + ข้อมูลให้ GPT เรียบเรียง */
export type FollowUpReply = {
  template: string;
  extra?: Pick<ChatMessageOf<"ai_text">, "cta" | "suggest">;
  facts: Omit<ChatWriterInput, "conversation" | "avoid">;
};

export type FollowUp = { kind: "use_card_qty"; qty: number } | { kind: "reply"; reply: FollowUpReply } | null;

type Context = {
  intent: Intent;
  text: string;
  /** การ์ดข้อเสนอล่าสุดที่ยังยืนยันได้ */
  open?: ChatMessageOf<"offers">;
  messages: ChatMessage[];
  config: MerchantConfig;
  buyerName: string;
  ownerName: string;
};

const HUMAN = (owner: string) => `กด "คุยกับคนจริง" ที่หัวแชตให้${owner}คุยเองได้เลยครับ`;

/** จำนวนที่ลูกค้าขอในการ์ด = จำนวนของข้อที่ไม่ใช่ "ซื้อเยอะ" */
const askedQty = (card: ChatMessageOf<"offers">) => (card.offers.find((o) => o.lever !== "volume") ?? card.offers[0])?.qty ?? null;

/**
 * ตัดสินว่าข้อความนี้ต้องตอบแบบไหนก่อนเข้า Deal Engine · null = ให้ engine คิดตามปกติ
 * หลอกระบบ / คืนเงิน / ร้องเรียน ไม่ผ่านตรงนี้ (คำตอบตายตัว + ส่งเถ้าแก่ตามกฎเดิม)
 */
export function followUp(ctx: Context): FollowUp {
  const { intent, text, open, messages, config } = ctx;
  if (intent.injectionSuspected || intent.intent === "refund" || intent.intent === "complaint") return null;
  const product = config.products.find((p) => p.sku === (intent.sku ?? open?.sku));
  const card = open && !open.confirmed && (intent.sku === null || intent.sku === open.sku) ? open : undefined;
  // จำนวนเดิม (หรือไม่บอก) = ไม่มีข้อมูลใหม่
  const noNewQty = intent.quantity === null || (card?.offers.some((o) => o.qty === intent.quantity) ?? false);
  const negotiating = intent.intent === "negotiate_price" || intent.intent === "order";

  // งบรวมมาก่อนหงุดหงิด: GPT ชอบติดธง "หงุดหงิด" จากข้อความเก่า ทั้งที่ข้อความนี้ถามงบชัดๆ
  if (product && intent.budgetTotal && intent.quantity === null) {
    return { kind: "reply", reply: budgetReply(ctx, product, intent.budgetTotal) };
  }
  if (intent.frustrated && intent.requestedPrice === null && noNewQty) {
    return { kind: "reply", reply: frustratedReply(ctx, card, product) };
  }
  if (!negotiating || !product) return null;
  // ขอเท่าราคาปกติขึ้นไปโดยไม่บอกจำนวน ("150 บาทได้เท่าไหร่") → ได้อยู่แล้ว + ทางที่ถูกกว่า (ไม่ออกการ์ดขายราคาเต็ม)
  if (intent.requestedPrice !== null && intent.quantity === null && intent.requestedPrice >= product.listPrice) {
    return { kind: "reply", reply: priceGuideReply(ctx, product, intent.requestedPrice) };
  }

  if (card) {
    // "ไม่เอาของแถม" = ต่อรองรอบใหม่โดยตัดข้อนั้น (กฎเดิม) — ไม่ใช่ขอลดเฉยๆ
    const rejects = rejectedLevers([text]).length > 0 || rejectedLetters(text).length > 0;
    if (intent.requestedPrice !== null && intent.quantity === null) {
      const qty = askedQty(card);
      return qty ? { kind: "use_card_qty", qty } : null;
    }
    if (intent.requestedPrice === null && noNewQty && !rejects) {
      const asks = 1 + messages.slice(messages.indexOf(card) + 1).filter((m) => m.type === "buyer_text").length;
      return { kind: "reply", reply: holdOffersReply(ctx, card, product, asks) };
    }
    return null;
  }

  // เพิ่งยืนยันออเดอร์ (ยังไม่มีการต่อรองรอบใหม่) แล้วขอลด → พูดถึงออเดอร์นั้น ไม่ถามจำนวนใหม่
  const lastDeal = messages.findLast((m) => m.type === "offers" || m.type === "order_summary");
  if (lastDeal?.type === "order_summary" && intent.quantity === null && intent.requestedPrice === null && intent.intent === "negotiate_price") {
    return { kind: "reply", reply: afterOrderReply(ctx, lastDeal, product) };
  }
  return null;
}

/** ยังไม่รู้จำนวน: ราคาปกติ + ราคาตามจำนวน + ราคาโอนทันที (+ ราคาที่ขอได้ถ้าทำอะไร) แล้วถามจำนวน */
export function priceGuideReply(ctx: Pick<Context, "buyerName" | "ownerName">, product: Product, requested: number | null): FollowUpReply {
  const guide = priceGuide(product);
  const ladder = [
    ...guide.tiers.map((t) => `${formatQty(t.minQty)} ชิ้นขึ้นไป ${formatBaht(t.price)}`),
    ...(guide.cashPrice !== null ? [`โอนทันที ${formatBaht(guide.cashPrice)}`] : []),
  ];
  const asked = requested === null ? null : Math.ceil(requested);
  let reach = "";
  if (asked !== null) {
    const r = reachPrice(guide, asked);
    const lowest = guide.tiers.at(-1);
    const ways = [
      ...(r.cash && guide.cashPrice !== null ? [`โอนทันที (${formatBaht(guide.cashPrice)})`] : []),
      ...(r.tier ? [`สั่ง ${formatQty(r.tier.minQty)} ชิ้นขึ้นไป (${formatBaht(r.tier.price)})`] : []),
    ];
    reach = r.atList
      ? `ราคา ${formatBaht(asked)} ได้อยู่แล้วครับ`
      : ways.length
        ? `ราคา ${formatBaht(asked)} ได้ครับ ถ้า${ways.join(" หรือ ")}`
        : lowest
          ? `ราคา ${formatBaht(asked)} ยังให้ไม่ได้ครับ ถูกสุดคือ ${formatBaht(lowest.price)} เมื่อสั่ง ${formatQty(lowest.minQty)} ชิ้นขึ้นไป`
          : `ราคา ${formatBaht(asked)} ยังให้ไม่ได้ครับ`;
  }
  const template = [
    `${product.name} ราคาปกติ ${formatBaht(guide.listPrice)} ต่อชิ้นครับ`,
    reach,
    ladder.length ? `ราคาส่งตามจำนวน ${ladder.join(" · ")}` : "",
    "ต้องการกี่ชิ้นครับ",
  ]
    .filter(Boolean)
    .join(" ");
  return {
    template,
    facts: {
      ...base(ctx, product),
      kind: "price_guide",
      points: [`ราคาปกติ ${formatBaht(guide.listPrice)} ต่อชิ้น`, ...(reach ? [reach] : []), ...(ladder.length ? [`ราคาส่งตามจำนวน: ${ladder.join(" · ")}`] : [])],
      askQuantity: true,
      numbers: [
        guide.listPrice,
        ...guide.tiers.flatMap((t) => [t.minQty, t.price]),
        ...(guide.cashPrice !== null ? [guide.cashPrice] : []),
        ...(asked !== null ? [asked] : []),
      ],
      // อย่างน้อยต้องบอกขั้นราคาแรก (ทางที่ถูกลงจริง) ไม่ใช่พูดลอยๆ ว่า "ซื้อเยอะก็ลด"
      required: guide.tiers.length ? [guide.tiers[0].minQty, guide.tiers[0].price] : [guide.listPrice],
      letters: [],
      names: [product.name],
    },
  };
}

/** มีการ์ดอยู่แล้ว ขอลดอีก → ราคาในการ์ดดีที่สุดสำหรับจำนวนนี้ + ทางที่ถูกกว่าจริง (ขั้นถัดไป) · ขอซ้ำ → ชวนคุยกับคนจริง */
function holdOffersReply(ctx: Context, card: ChatMessageOf<"offers">, product: Product, asks: number): FollowUpReply {
  const offers = card.offers;
  const cheapest = offers.reduce((a, b) => (b.pricePerUnit < a.pricePerUnit ? b : a));
  const maxQty = Math.max(...offers.map((o) => o.qty));
  const next = priceGuide(product).tiers.find((t) => t.minQty > maxQty && t.price < cheapest.pricePerUnit);
  const best = `ถูกสุดคือข้อ ${cheapest.id} ${formatBaht(cheapest.pricePerUnit)} ${condition(cheapest)}`;
  const further = next ? `ถ้าสั่ง ${formatQty(next.minQty)} ชิ้นขึ้นไป ${formatBaht(next.price)}` : "";
  const close = asks >= 2 ? `ถ้าอยากต่อรองเพิ่ม ${HUMAN(ctx.ownerName)}` : "สนใจข้อไหนกดยืนยันในการ์ดได้เลยครับ";
  const template = [
    `${ctx.buyerName} ราคาในการ์ดด้านบนเป็นราคาที่ดีที่สุดที่${ctx.ownerName}ให้ได้สำหรับจำนวนนี้ครับ`,
    best,
    further ? `${further}ครับ` : "",
    close,
  ]
    .filter(Boolean)
    .join(" ");
  return {
    template,
    extra: { cta: "show_offers", suggest: "trade_offs" },
    facts: {
      ...base(ctx, product, offers),
      kind: "hold_offers",
      points: [
        `ราคาในการ์ดด้านบนเป็นราคาที่ดีที่สุดที่${ctx.ownerName}ให้ได้สำหรับจำนวนนี้ (ลดเพิ่มไม่ได้)`,
        best,
        ...(further ? [`ถ้าอยากได้ถูกกว่านี้: ${further}`] : []),
        asks >= 2 ? `ถ้าอยากต่อรองเพิ่ม ${HUMAN(ctx.ownerName)}` : "ชวนเลือกข้อที่สนใจแล้วกดยืนยันในการ์ด",
      ],
      askQuantity: false,
      numbers: [...offerNumbers(offers), ...(next ? [next.minQty, next.price] : [])],
      required: [cheapest.pricePerUnit, ...(next ? [next.minQty, next.price] : [])],
      ...(asks >= 2 && { requiredWords: ["คุยกับคนจริง"] }),
    },
  };
}

/** เพิ่งยืนยันออเดอร์แล้วขอลด → ออเดอร์นี้เป็นราคาที่ตกลงแล้ว + ขั้นราคาถัดไปสำหรับรอบหน้า */
function afterOrderReply(ctx: Context, order: ChatMessageOf<"order_summary">, product: Product): FollowUpReply {
  const o = order.offer;
  const next = priceGuide(product).tiers.find((t) => t.minQty > o.qty && t.price < o.pricePerUnit);
  const done = `ออเดอร์ข้อ ${o.id} ${o.label} ${formatBaht(o.pricePerUnit)} × ${formatQty(o.qty)} ชิ้น ยืนยันแล้ว เป็นราคาที่ตกลงกันไว้`;
  const further = next ? `ถ้าสั่งรอบหน้า ${formatQty(next.minQty)} ชิ้นขึ้นไป ${formatBaht(next.price)}` : "";
  const template = [`${done}ครับ${ctx.buyerName}`, further ? `${further}ครับ` : "", `ถ้ามีเรื่องอื่น ${HUMAN(ctx.ownerName)}`]
    .filter(Boolean)
    .join(" ");
  return {
    template,
    facts: {
      ...base(ctx, product, [o]),
      kind: "after_order",
      points: [done, ...(further ? [further] : []), `ถ้ามีเรื่องอื่น ${HUMAN(ctx.ownerName)}`],
      askQuantity: false,
      numbers: [...offerNumbers([o]), ...(next ? [next.minQty, next.price] : [])],
      required: [o.pricePerUnit, ...(next ? [next.minQty, next.price] : [])],
    },
  };
}

/** "320 บาทได้กี่เส้น" → จำนวนที่ได้มากสุดในงบนั้น */
function budgetReply(ctx: Context, product: Product, budget: number): FollowUpReply {
  const guide = priceGuide(product);
  const r = budgetQty(guide, budget);
  const answer = r
    ? `งบ ${formatBaht(budget)} ได้ ${formatQty(r.qty)} ชิ้น ชิ้นละ ${formatBaht(r.pricePerUnit)} รวม ${formatBaht(r.total)}`
    : `งบ ${formatBaht(budget)} ยังไม่พอ 1 ชิ้น ราคาปกติชิ้นละ ${formatBaht(guide.listPrice)}`;
  return {
    template: `${answer}ครับ ${r ? "สนใจสั่งเลยไหมครับ" : "ต้องการกี่ชิ้นครับ"}`,
    facts: {
      ...base(ctx, product),
      kind: "budget",
      points: [answer, r ? "ถามว่าสนใจสั่งไหม" : "ถามว่าต้องการกี่ชิ้น"],
      askQuantity: !r,
      numbers: [budget, guide.listPrice, 1, ...(r ? [r.qty, r.pricePerUnit, r.total] : [])],
      required: r ? [r.qty] : [guide.listPrice],
    },
  };
}

/** ลูกค้าหงุดหงิด → ขอโทษ + บอกสถานะตอนนี้สั้นๆ + ชวนคุยกับคนจริง */
function frustratedReply(ctx: Context, card: ChatMessageOf<"offers"> | undefined, product: Product | undefined): FollowUpReply {
  const now = card
    ? `ตอนนี้มีข้อเสนอ ${card.offers.length} ทางในการ์ดด้านบน เลือกข้อที่สนใจได้เลย`
    : "บอกจำนวนที่ต้องการมาได้เลย เดี๋ยวคิดราคาที่คุ้มที่สุดให้";
  return {
    template: `ขอโทษครับ${ctx.buyerName} ถ้าผมตอบไม่ตรง ${now}ครับ หรือ${HUMAN(ctx.ownerName)}`,
    ...(card && { extra: { cta: "show_offers" } }),
    facts: {
      ...base(ctx, product, card?.offers ?? []),
      kind: "frustrated",
      points: ["ขอโทษที่ตอบไม่ตรงใจ", now, `หรือ${HUMAN(ctx.ownerName)}`],
      askQuantity: false,
      numbers: card ? [card.offers.length] : [],
      requiredWords: ["ขอโทษ|ขออภัย", "คุยกับคนจริง"],
    },
  };
}

/** คุยเล่น/ทักทาย/เรื่องอื่น (template เดิมเป็นคำตอบสำรอง) */
export function chatReply(ctx: Pick<Context, "buyerName" | "ownerName">, product: Product | undefined, template: string): FollowUpReply {
  return {
    template,
    facts: {
      ...base(ctx, product),
      kind: "chat",
      points: product
        ? [`ผู้ช่วยของ${ctx.ownerName}ช่วยเรื่องราคาและสั่งซื้อ${product.name}`, `ราคาปกติ ${formatBaht(product.listPrice)} ต่อชิ้น`, "ชวนบอกจำนวนกับราคาที่อยากได้"]
        : ["ผู้ช่วยช่วยเรื่องราคาและสั่งซื้อ", "ชวนเลือกสินค้าหรือบอกสินค้าที่สนใจ"],
      askQuantity: !!product,
      numbers: product ? [product.listPrice] : [],
    },
  };
}

/** ถามเรื่องที่เถ้าแก่ยังไม่ได้ให้ข้อมูลไว้ */
export function infoUnknownReply(ctx: Pick<Context, "buyerName" | "ownerName">, product: Product | undefined, template: string): FollowUpReply {
  return {
    template,
    facts: {
      ...base(ctx, product),
      kind: "info_unknown",
      points: ["เรื่องนี้ผู้ช่วยยังไม่มีข้อมูล ตอบเองไม่ได้", `${HUMAN(ctx.ownerName)} เพื่อถามเรื่องนี้`, "ผู้ช่วยช่วยได้เรื่องราคา สต๊อก การส่ง และการจ่ายเงิน"],
      askQuantity: false,
      numbers: [],
    },
  };
}

/** บทสนทนาล่าสุดให้ GPT (ข้อความลูกค้าตอนนี้อยู่ท้าย) + ข้อความที่ร้านเพิ่งตอบ (ห้ามซ้ำ) */
export function conversationOf(messages: ChatMessage[], current: string): { conversation: ChatTurn[]; avoid: string[] } {
  const turns: ChatTurn[] = messages.flatMap((m): ChatTurn[] =>
    m.type === "buyer_text"
      ? [{ from: "customer", text: m.text }]
      : m.type === "ai_text" || m.type === "owner_text"
        ? [{ from: "shop", text: m.text }]
        : m.type === "ai_voice"
          ? [{ from: "shop", text: m.transcript }]
          : [],
  );
  const avoid = messages.flatMap((m) => (m.type === "ai_text" ? [m.text] : [])).slice(-3);
  return { conversation: [...turns.slice(-8), { from: "customer", text: current }], avoid };
}

function base(ctx: Pick<Context, "buyerName" | "ownerName">, product: Product | undefined, offers: Offer[] = []) {
  return {
    buyerName: ctx.buyerName,
    ownerName: ctx.ownerName,
    ...(product && { productName: product.name }),
    letters: offers.map((o) => o.id),
    names: [product?.name ?? "", ...offers.flatMap((o) => (o.bundle ? [o.bundle.name] : []))],
  };
}

function condition(o: Offer): string {
  if (o.lever === "volume") return `เมื่อสั่ง ${formatQty(o.qty)} ชิ้น`;
  if (o.lever === "cash") return "เมื่อโอนทันที";
  if (o.bundle) return `แถม${o.bundle.name} ${formatQty(o.bundle.qty)} ชิ้น`;
  return `${formatQty(o.qty)} ชิ้น`;
}

function offerNumbers(offers: Offer[]): number[] {
  return offers.flatMap((o) => [o.pricePerUnit, o.qty, o.total, ...(o.bundle ? [o.bundle.qty] : []), ...(o.creditDays > 0 ? [o.creditDays] : [])]);
}
