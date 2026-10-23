// ตัวตอบจำลองของเฟส 2 — ใช้กับ /?state=… (ตรวจหน้าตา) และ test ส่วนแชตจริงใช้ API (เฟส 4)
// คำตอบทั้งหมดเอามาจากข้อความในไฟล์ดีไซน์ ไม่ได้คิดราคาจริง (ข้อเสนอใช้ MOCK_OFFERS เสมอ)
import type { ChatAction, Suggestion } from "./actions";
import { MOCK_OFFERS } from "./mock-offers";
import { greetingText, productIntroText, replyFor, type ReplyContext } from "./replies";
import { lastOffers, tradeOffChips } from "./suggestions";
import type { ChatMessage, ChatMessageDraft as Draft, ChatMessageOf, PublicProduct, Storefront } from "./types";

export type ChatState = {
  messages: ChatMessage[];
  suggestions: Suggestion[];
  /** human = ส่งเรื่องให้เถ้าแก่แล้ว AI หยุดตอบ */
  mode: "ai" | "human";
  seq: number;
};

export type MockContext = {
  storefront: Storefront;
  products: PublicProduct[];
  buyerName: string;
  now: () => string;
  /** จำลอง Voice API ล่ม (Mobile-NoVoice) */
  voiceFails?: boolean;
};

const DEMO_NEGOTIATION = "ขอ 125 ได้ไหมคะ 1,000 ชิ้น ร้านข้างๆ ให้ 110";

function append(state: ChatState, ctx: MockContext, drafts: Draft[], patch: Partial<ChatState> = {}): ChatState {
  let seq = state.seq;
  const at = ctx.now();
  const added = drafts.map((d) => ({ ...d, id: `m${++seq}`, at }) as ChatMessage);
  return { ...state, ...patch, messages: [...state.messages, ...added], seq };
}

export function initialChatState(ctx: MockContext): ChatState {
  const empty: ChatState = { messages: [], suggestions: [], mode: "ai", seq: 0 };
  return append(
    empty,
    ctx,
    [
      {
        type: "ai_text",
        text: greetingText(ctx.storefront),
        cta: "open_products",
      },
    ],
    { suggestions: [{ label: "ดูสินค้าทั้งหมด", action: { type: "open_products" } }] },
  );
}

export function mockRespond(state: ChatState, action: ChatAction, ctx: MockContext): ChatState {
  switch (action.type) {
    case "pick_product": {
      const product = ctx.products.find((p) => p.sku === action.sku);
      if (!product) return state;
      const card: Draft = { type: "product_card", sku: product.sku, name: product.name, listPrice: product.listPrice };
      // ส่งเรื่องให้เถ้าแก่แล้ว — เก็บการ์ดไว้ให้เถ้าแก่เห็น AI ไม่ตอบ
      if (state.mode === "human") return append(state, ctx, [card], { suggestions: [] });
      return append(
        state,
        ctx,
        [
          card,
          { type: "ai_text", text: productIntroText(product) },
        ],
        {
          suggestions: [
            { label: DEMO_NEGOTIATION, action: { type: "send", text: DEMO_NEGOTIATION, inputMode: "text" } },
          ],
        },
      );
    }

    case "send":
      return respondToText(state, action, ctx);

    case "select_offer":
      return updateOffers(state, action.messageId, (m) =>
        m.confirmed ? m : { ...m, selectedId: action.offerId },
      );

    case "confirm_offer": {
      if (state.mode === "human") return state;
      const message = findOffers(state, action.messageId);
      const offer = message?.offers.find((o) => o.id === action.offerId);
      if (!message || !offer || message.confirmed) return state;
      const product = ctx.products.find((p) => p.sku === message.sku);
      const confirmed = updateOffers(state, message.id, (m) => ({ ...m, selectedId: offer.id, confirmed: true }));
      return append(
        confirmed,
        ctx,
        [
          { type: "buyer_text", text: `เลือกข้อ ${offer.id} · ${offer.label}`, inputMode: "text" },
          { type: "order_summary", orderId: `demo-${offer.id}`, offer, productName: product?.name ?? message.sku },
        ],
        { suggestions: [{ label: "ต่อราคาสินค้าอื่น", action: { type: "open_products" } }] },
      );
    }

    case "talk_to_human":
      if (state.mode === "human") return state;
      return append(state, ctx, [{ type: "handoff", subject: "ขอคุยกับคนจริง" }], {
        mode: "human",
        suggestions: [],
      });
  }
}

function respondToText(
  state: ChatState,
  action: Extract<ChatAction, { type: "send" }>,
  ctx: MockContext,
): ChatState {
  const text = action.text.trim();
  if (!text) return state;
  const withBuyer = append(state, ctx, [{ type: "buyer_text", text, inputMode: action.inputMode }], {
    suggestions: [],
  });
  // ส่งเรื่องให้เถ้าแก่แล้ว — เก็บข้อความไว้ให้เถ้าแก่อ่าน AI ไม่ตอบ
  if (state.mode === "human") return withBuyer;

  const openOffers = lastOffers(state.messages);

  // ใช้ข้อความชุดเดียวกับแชตจริง (replies.ts) — ต่างกันแค่ตัวตอบจำลองไม่ผ่าน Deal Engine
  const replyCtx: ReplyContext = {
    storefront: ctx.storefront,
    buyerName: ctx.buyerName,
    requestedPrice: null,
    qty: null,
    openOffers,
  };
  const noCounters = { belowFloorCount: 0, injectionCount: 0 };

  if (/ลืมคำสั่ง|ignore previous/i.test(text)) {
    const { messages } = replyFor({ kind: "guard", state: noCounters }, replyCtx);
    return append(withBuyer, ctx, messages, { suggestions: tradeOffChips(openOffers) });
  }

  if (/ต้นทุน/.test(text)) {
    const { messages } = replyFor({ kind: "not_negotiation", state: noCounters }, { ...replyCtx, asksCost: true });
    return append(withBuyer, ctx, messages, { suggestions: tradeOffChips(openOffers) });
  }

  if (/คืนเงิน|ของเสีย/.test(text)) {
    const [apology] = replyFor(
      { kind: "escalate", reason: "refund", brief: ["", "", ""], state: noCounters },
      replyCtx,
    ).messages;
    return append(
      withBuyer,
      ctx,
      [apology, { type: "handoff", subject: "ขอคืนเงิน · ของเสีย 50 ชิ้น", orderRef: ctx.storefront.orderRefPlaceholder }],
      { mode: "human" },
    );
  }

  // ต่อราคา: ตอบตามแบบที่ลูกค้าใช้ — พูดมาได้เสียง พิมพ์มาได้ข้อความ
  const reply = `สวัสดีครับ${ctx.buyerName} ราคา 125 ที่ 1,000 ชิ้นเฮียให้ไม่ไหว แต่มี 3 ทางให้เลือกครับ`;
  const spoken: Draft[] =
    action.inputMode === "voice" && !ctx.voiceFails
      ? [{ type: "ai_voice", durationSec: 14, transcript: reply }]
      : [
          ...(action.inputMode === "voice" ? [{ type: "system", kind: "voice_unavailable" } as Draft] : []),
          { type: "ai_text", text: reply },
        ];
  const sku = lastProductSku(state) ?? ctx.products[0]?.sku ?? "";
  return append(withBuyer, ctx, [...spoken, { type: "offers", sku, offers: MOCK_OFFERS }]);
}

function lastProductSku(state: ChatState): string | undefined {
  const card = [...state.messages].reverse().find((m) => m.type === "product_card");
  return card?.type === "product_card" ? card.sku : undefined;
}

function findOffers(state: ChatState, id: string): ChatMessageOf<"offers"> | undefined {
  const m = state.messages.find((x) => x.id === id);
  return m?.type === "offers" ? m : undefined;
}

function updateOffers(
  state: ChatState,
  id: string,
  fn: (m: ChatMessageOf<"offers">) => ChatMessageOf<"offers">,
): ChatState {
  if (!findOffers(state, id)) return state;
  return {
    ...state,
    messages: state.messages.map((m) => (m.id === id && m.type === "offers" ? fn(m) : m)),
  };
}
