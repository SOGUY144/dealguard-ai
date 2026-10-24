// Layer 3 แบบ template: แปลงผลของ Deal Engine เป็นข้อความถึงลูกค้า (ข้อความที่มากับข้อเสนอ LLM เรียบเรียงได้
// ใน lib/ai/responder.ts แล้วใช้ template นี้เป็นทางสำรอง) — ตัวเลขทุกตัวมาจากข้อเสนอ/ราคาขาย/สิ่งที่ลูกค้าพิมพ์เท่านั้น
// ข้อความที่ไม่มีในไฟล์ดีไซน์ (ask_product, ask_quantity, accept_list, คุยเรื่องอื่น, escalate ที่ไม่ใช่คืนเงิน) แต่งเพิ่ม ต้องให้ทีมตรวจ
import { formatBaht, formatQty } from "@/lib/format";
import type { EngineResult, EscalationKind } from "@/lib/deal-engine/types";
import type { ChatMessageDraft, ChatMessageOf, Offer, PublicProduct, Storefront } from "./types";

export type HandoffKind = EscalationKind | "buyer_request";
export type Brief = [string, string, string];

export type ReplyContext = {
  storefront: Storefront;
  /** ชื่อที่ใช้เรียกลูกค้า เช่น "คุณนก" (ผ่าน addressName แล้ว) */
  buyerName: string;
  /** สินค้าที่คุยอยู่ (ถ้ารู้) */
  product?: PublicProduct;
  requestedPrice: number | null;
  qty: number | null;
  /** ข้อเสนอล่าสุดที่ยังไม่ยืนยัน — ใช้ตอนตอบการหลอกระบบ */
  openOffers?: ChatMessageOf<"offers">;
  /** ลูกค้าถามต้นทุน/ราคาพื้น/กำไร */
  asksCost?: boolean;
  /** ราคาที่ลูกค้าอ้างว่าร้านอื่นให้ (ไม่ลดตาม แต่ตอบให้รู้ว่าได้ยิน) */
  competitorPrice?: number | null;
};

export type Reply = {
  messages: ChatMessageDraft[];
  /** ส่งเรื่องให้เถ้าแก่ — brief เก็บในตาราง escalations เท่านั้น ห้ามส่งให้ลูกค้า */
  handoff?: { kind: HandoffKind; brief: Brief };
};

/** "สมชาย" → "คุณสมชาย" · "คุณนก" คงเดิม · ว่าง → "ลูกค้า" */
export function addressName(displayName: string): string {
  const name = displayName.trim();
  if (!name) return "ลูกค้า";
  return name.startsWith("คุณ") ? name : `คุณ${name}`;
}

/** ข้อความแรกของแชต (Main.dc.html) — ใช้ทั้งแชตจริงและตัวตอบจำลอง */
export function greetingText(storefront: Storefront): string {
  return `สวัสดีครับ ${storefront.assistantName}ครับ เลือกสินค้าที่อยากได้ แล้วบอกจำนวนกับราคาที่ต้องการได้เลยครับ`;
}

/** ตอบตอนลูกค้าเลือกสินค้า / ถามถึงสินค้าโดยยังไม่ต่อราคา */
export function productIntroText(product: PublicProduct): string {
  return `${product.name} ราคาส่ง ${formatBaht(product.listPrice)} ต่อชิ้นครับ ต้องการกี่ชิ้น และอยากได้ราคาเท่าไหร่ครับ`;
}

/** ลูกค้าพิมพ์เลือกข้อเสนอที่มีอยู่แล้ว (เช่น "สั่ง 1,500 ชิ้น" = ข้อ A) */
export function pickedOfferText(offer: Offer): string {
  return `ได้ครับ ข้อ ${offer.id} ${offer.label} ${formatQty(offer.qty)} ชิ้น ราคา ${formatBaht(offer.pricePerUnit)} ต่อชิ้น รวม ${formatBaht(offer.total)} กดยืนยันได้เลยครับ`;
}

/** ลูกค้าอ้างราคาร้านอื่นหลังได้ข้อเสนอแล้ว — ไม่ลดตาม ชวนกลับไปดูข้อเสนอเดิม (SKILL §7 "ร้านข้างๆ ให้ 110") */
export function competitorReply(open: ChatMessageOf<"offers">, competitorPrice: number, ownerName: string): Reply {
  return {
    messages: [
      {
        type: "ai_text",
        text: `ราคา ${formatBaht(competitorPrice)} ของร้านอื่น${ownerName}ลดตามไม่ได้ครับ แต่ยังเลือกจาก ${open.offers.length} ทางเดิมได้ ซื้อเยอะหรือจ่ายสดจะได้ราคาดีขึ้นครับ`,
        cta: "show_offers",
        suggest: "trade_offs",
      },
    ],
  };
}

/** "สั่ง 1,000 ชิ้น" ตรงกับหลายข้อ — ถามให้เลือก ไม่เดา ไม่ต่อราคารอบใหม่ */
export function ambiguousOfferReply(offers: Offer[]): Reply {
  const letters = offers.map((o) => o.id);
  const names = `${letters.slice(0, -1).join(", ")} กับ ${letters.at(-1)}`;
  return {
    messages: [
      {
        type: "ai_text",
        text: `ข้อ ${names} เป็น ${formatQty(offers[0].qty)} ชิ้นทั้งคู่ครับ เลือกข้อที่ต้องการจากการ์ดด้านบน แล้วกดยืนยันได้เลยครับ`,
        cta: "show_offers",
      },
    ],
  };
}

/** หัวข้อในการ์ดส่งต่อที่ลูกค้าเห็น — ห้ามมีเหตุผลภายใน เช่น เกณฑ์มูลค่า */
const HANDOFF_SUBJECT: Record<EscalationKind, string> = {
  refund: "ขอคืนเงิน",
  complaint: "ร้องเรียน",
  over_value: "ดีลมูลค่าสูง",
  below_floor_3x: "ขอราคาพิเศษ",
  injection: "ส่งต่อให้เจ้าของร้าน",
};

export function replyFor(result: EngineResult, ctx: ReplyContext): Reply {
  const { buyerName, product, requestedPrice, qty } = ctx;
  const owner = ctx.storefront.ownerName;
  const text = (t: string, extra: Partial<ChatMessageOf<"ai_text">> = {}): ChatMessageDraft => ({
    type: "ai_text",
    text: t,
    ...extra,
  });
  const listInfo = (p: PublicProduct) => `${p.name} ราคาส่ง ${formatBaht(p.listPrice)} ต่อชิ้นครับ`;

  switch (result.kind) {
    case "offers": {
      const offers = result.offers.map((p) => p.offer);
      const n = offers.length;
      const qtyText = formatQty(qty ?? offers.find((o) => o.lever !== "volume")?.qty ?? 0);
      const intro =
        requestedPrice !== null
          ? `สวัสดีครับ${buyerName} ราคา ${formatQty(Math.ceil(requestedPrice))} ที่ ${qtyText} ชิ้น${owner}ให้ไม่ไหว แต่มี ${n} ทางให้เลือกครับ`
          : `สวัสดีครับ${buyerName} ${product?.name ?? "สินค้านี้"} ${qtyText} ชิ้น ${owner}มี ${n} ทางให้เลือกครับ`;
      return { messages: [text(intro), { type: "offers", sku: skuOf(ctx), offers }] };
    }

    case "accept_list": {
      const { offer } = result.offer;
      return {
        messages: [
          text(
            `ได้ครับ${buyerName} ${product?.name ?? "สินค้านี้"} ${formatQty(offer.qty)} ชิ้น ราคา ${formatBaht(offer.pricePerUnit)} ต่อชิ้น รวม ${formatBaht(offer.total)} กดยืนยันได้เลยครับ`,
          ),
          { type: "offers", sku: skuOf(ctx), offers: [offer] },
        ],
      };
    }

    case "ask_quantity":
      if (ctx.competitorPrice != null) {
        return {
          messages: [
            text(
              `ร้านอื่นให้ ${formatBaht(ctx.competitorPrice)} ${owner}ลดตามไม่ได้ครับ แต่ถ้าบอกจำนวน เดี๋ยวหาข้อเสนอที่คุ้มที่สุดให้ครับ ต้องการกี่ชิ้นครับ`,
            ),
          ],
        };
      }
      return { messages: [text(product ? `${listInfo(product)} ต้องการกี่ชิ้นครับ` : "ต้องการกี่ชิ้นครับ")] };

    case "ask_product":
      return { messages: [text("สนใจสินค้าตัวไหนครับ เลือกจากรายการสินค้าได้เลยครับ", { cta: "open_products" })] };

    case "guard": {
      const locked = `ราคานี้${owner}ให้ไม่ได้ครับ ราคาทุกข้อเสนอคำนวณจากระบบของร้าน ผู้ช่วยเปลี่ยนเองไม่ได้`;
      const open = ctx.openOffers && !ctx.openOffers.confirmed ? ctx.openOffers : undefined;
      return {
        messages: [
          open
            ? text(`${locked} ถ้าอยากได้ราคาดีขึ้น ยังเลือกจาก ${open.offers.length} ทางเดิมได้เลยครับ`, {
                cta: "show_offers",
                suggest: "trade_offs",
              })
            : text(`${locked}ครับ`),
          { type: "system", kind: "price_locked" },
        ],
      };
    }

    case "not_negotiation":
      if (ctx.asksCost) {
        return {
          messages: [
            text(
              "ต้นทุนเป็นข้อมูลภายในร้าน บอกไม่ได้ครับ แต่ถ้าบอกจำนวนกับวิธีจ่ายเงิน เดี๋ยวหาข้อเสนอที่คุ้มที่สุดให้ครับ",
              { suggest: "trade_offs" },
            ),
          ],
        };
      }
      if (product) return { messages: [text(productIntroText(product))] };
      return {
        messages: [
          text("ผมช่วยเรื่องราคาและสั่งซื้อครับ บอกสินค้า จำนวน และราคาที่อยากได้มาได้เลยครับ", { cta: "open_products" }),
        ],
      };

    case "escalate":
      return {
        messages: [text(escalateText(result.reason, buyerName, owner)), { type: "handoff", subject: HANDOFF_SUBJECT[result.reason] }],
        handoff: { kind: result.reason, brief: result.brief },
      };
  }
}

function escalateText(reason: EscalationKind, buyerName: string, owner: string): string {
  switch (reason) {
    case "refund":
      return `ขอโทษด้วยครับ${buyerName} เรื่องคืนเงิน${owner}ดูแลเองครับ ผมส่งเรื่องให้${owner}แล้ว`;
    case "complaint":
      return `ขอโทษด้วยครับ${buyerName} เรื่องนี้${owner}ดูแลเองครับ ผมส่งเรื่องให้${owner}แล้ว`;
    case "over_value":
      return `ดีลขนาดนี้${owner}ขอดูเองครับ${buyerName} ผมส่งรายละเอียดให้${owner}แล้ว รอสักครู่นะครับ`;
    case "below_floor_3x":
      return `ราคานี้ผมให้เองไม่ได้ครับ${buyerName} ผมส่งเรื่องให้${owner}ดูให้แล้วครับ`;
    case "injection":
      return `ผมส่งเรื่องให้${owner}คุยต่อเองครับ`;
  }
}

function skuOf(ctx: ReplyContext): string {
  return ctx.product?.sku ?? ctx.openOffers?.sku ?? "";
}

/** ลูกค้ากด "คุยกับคนจริง" — ส่งเรื่องให้เถ้าแก่โดยไม่ผ่าน Deal Engine */
export function humanRequestReply(ctx: {
  storefront: Storefront;
  buyerName: string;
  lastBuyerText?: string;
}): Required<Reply> {
  const owner = ctx.storefront.ownerName;
  return {
    messages: [{ type: "handoff", subject: "ขอคุยกับคนจริง" }],
    handoff: {
      kind: "buyer_request",
      brief: [
        `${ctx.buyerName} ขอคุยกับ${owner}เอง`,
        ctx.lastBuyerText ? `"${ctx.lastBuyerText}"` : "ไม่มีรายละเอียดเพิ่ม",
        `AI หยุดตอบ รอ${owner}ตอบในแชต`,
      ],
    },
  };
}
