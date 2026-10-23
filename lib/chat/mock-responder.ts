// ตัวตอบจำลองของเฟส 2 — ใช้แทน API จนกว่าเฟส 4 (Layer 1/3) กับเฟส 6 (เสียง) จะพร้อม
// คำตอบทั้งหมดเอามาจากข้อความในไฟล์ดีไซน์ ไม่ได้คิดราคาจริง (ข้อเสนอใช้ MOCK_OFFERS เสมอ)
import { formatBaht } from "@/lib/format";
import { MOCK_OFFERS } from "./mock-offers";
import type { ChatMessage, ChatMessageOf, Offer, PublicProduct, Storefront } from "./types";

export type ChatAction =
  | { type: "pick_product"; sku: string }
  | { type: "send"; text: string; inputMode: "text" | "voice" }
  | { type: "select_offer"; messageId: string; offerId: Offer["id"] }
  | { type: "confirm_offer"; messageId: string }
  | { type: "talk_to_human" };

/** chip คำตอบด่วนเหนือช่องพิมพ์ */
export type Suggestion = {
  label: string;
  action: { type: "open_products" } | Extract<ChatAction, { type: "send" }>;
};

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

type Draft = ChatMessage extends infer M ? (M extends ChatMessage ? Omit<M, "id" | "at"> : never) : never;

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
        text: `สวัสดีครับ ${ctx.storefront.assistantName}ครับ เลือกสินค้าที่อยากได้ แล้วบอกจำนวนกับราคาที่ต้องการได้เลยครับ`,
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
      return append(
        state,
        ctx,
        [
          { type: "product_card", sku: product.sku, name: product.name, listPrice: product.listPrice },
          {
            type: "ai_text",
            text: `${product.name} ราคาส่ง ${formatBaht(product.listPrice)} ต่อชิ้นครับ ต้องการกี่ชิ้น และอยากได้ราคาเท่าไหร่ครับ`,
          },
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
      const message = findOffers(state, action.messageId);
      const offer = message?.offers.find((o) => o.id === message.selectedId);
      if (!message || !offer || message.confirmed) return state;
      const product = lastProduct(state, ctx);
      const confirmed = updateOffers(state, message.id, (m) => ({ ...m, confirmed: true }));
      return append(
        confirmed,
        ctx,
        [
          { type: "buyer_text", text: `เลือกข้อ ${offer.id} · ${offer.label}`, inputMode: "text" },
          { type: "order_summary", orderId: `demo-${offer.id}`, offer, productName: product?.name ?? "" },
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

  if (/ลืมคำสั่ง|ignore previous/i.test(text)) {
    return append(
      withBuyer,
      ctx,
      [
        {
          type: "ai_text",
          text: "ราคานี้เฮียให้ไม่ได้ครับ ราคาทุกข้อเสนอคำนวณจากระบบของร้าน ผู้ช่วยเปลี่ยนเองไม่ได้ ถ้าอยากได้ราคาดีขึ้น ยังเลือกจาก 3 ทางเดิมได้เลยครับ",
          cta: "show_offers",
        },
        { type: "system", kind: "price_locked" },
      ],
      { suggestions: TRADE_OFF_CHIPS },
    );
  }

  if (/ต้นทุน/.test(text)) {
    return append(
      withBuyer,
      ctx,
      [
        {
          type: "ai_text",
          text: "ต้นทุนเป็นข้อมูลภายในร้าน บอกไม่ได้ครับ แต่ถ้าบอกจำนวนกับวิธีจ่ายเงิน เดี๋ยวหาข้อเสนอที่คุ้มที่สุดให้ครับ",
        },
      ],
      { suggestions: TRADE_OFF_CHIPS },
    );
  }

  if (/คืนเงิน|ของเสีย/.test(text)) {
    const { ownerName } = ctx.storefront;
    return append(
      withBuyer,
      ctx,
      [
        {
          type: "ai_text",
          text: `ขอโทษด้วยครับ${ctx.buyerName} เรื่องคืนเงิน${ownerName}ดูแลเองครับ ผมส่งเรื่องให้เฮียแล้ว`,
        },
        { type: "handoff", subject: "ขอคืนเงิน · ของเสีย 50 ชิ้น", orderRef: ctx.storefront.orderRefPlaceholder },
      ],
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
  return append(withBuyer, ctx, [...spoken, { type: "offers", offers: MOCK_OFFERS }]);
}

const TRADE_OFF_CHIPS: Suggestion[] = [
  { label: "สั่ง 1,500 ชิ้น", action: { type: "send", text: "สั่ง 1,500 ชิ้น", inputMode: "text" } },
  { label: "จ่ายสด", action: { type: "send", text: "จ่ายสด", inputMode: "text" } },
];

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

function lastProduct(state: ChatState, ctx: MockContext): PublicProduct | undefined {
  const card = [...state.messages].reverse().find((m) => m.type === "product_card");
  const sku = card?.type === "product_card" ? card.sku : ctx.products[0]?.sku;
  return ctx.products.find((p) => p.sku === sku);
}
