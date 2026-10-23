// ต่อทุกชั้นของแชตลูกค้า: ข้อความ → Layer 1 (intent) → Layer 2 (Deal Engine) → Layer 3 (template) → เก็บลงที่เก็บ
// ตัวเลขราคาทุกตัวมาจาก Deal Engine · ยืนยันออเดอร์จากข้อเสนอที่ server เก็บไว้เท่านั้น
import "server-only";
import { parseIntent, type IntentLlm } from "@/lib/ai/intent";
import type { ChatAction, ChatView } from "@/lib/chat/actions";
import {
  addressName,
  greetingText,
  humanRequestReply,
  pickedOfferText,
  productIntroText,
  replyFor,
  type Reply,
} from "@/lib/chat/replies";
import { deriveSuggestions, lastOffers } from "@/lib/chat/suggestions";
import type { ChatMessage, ChatMessageDraft, ChatMessageOf, Offer, PublicProduct, Storefront } from "@/lib/chat/types";
import { runDealEngine } from "@/lib/deal-engine";
import type { Intent, MerchantConfig, NegotiationState, PricedOffer } from "@/lib/deal-engine/types";
import type { ChatStore, StoredChat } from "./store";

export type PipelineDeps = { store: ChatStore; storefront: Storefront; intentLlm: IntentLlm | null };
export type Buyer = { id: string; displayName: string };

/** ข้อความก่อนหน้าที่ส่งให้ GPT เข้าใจบริบท */
const HISTORY_LIMIT = 6;
const MAX_COUNTER_RETRIES = 3;
const ASKS_COST = /ต้นทุน|ราคาทุน|ราคาพื้น|กำไร|มาร์จิ้น|margin|cost|floor/i;

export async function loadChat(deps: PipelineDeps, buyer: Buyer): Promise<ChatView> {
  const chat = await openChat(deps, buyer);
  return view(chat, await deps.store.listMessages(chat.id));
}

/** หน้าแชต: แชตเดิม + สินค้าจากที่เก็บเดียวกับที่ Deal Engine ใช้ (แถบสินค้ากับราคาในแชตตรงกันเสมอ) */
export async function loadChatPage(
  deps: PipelineDeps,
  buyer: Buyer,
): Promise<{ view: ChatView; products: PublicProduct[] }> {
  const [view, config] = await Promise.all([loadChat(deps, buyer), deps.store.loadConfig()]);
  return { view, products: toPublicProducts(config) };
}

export async function handleAction(
  deps: PipelineDeps,
  buyer: Buyer,
  action: Exclude<ChatAction, { type: "select_offer" }>,
): Promise<ChatView> {
  const chat = await openChat(deps, buyer);
  // อ่านพร้อมกัน — ฐานข้อมูลอยู่ไกล (โซล) ทุก round trip มีผลกับเวลาตอบ
  const [messages, config] = await Promise.all([deps.store.listMessages(chat.id), deps.store.loadConfig()]);
  const unchanged = () => view(chat, messages);

  switch (action.type) {
    case "pick_product":
      return pickProduct(deps, config, chat, messages, action.sku, unchanged);
    case "send":
      return send(deps, config, buyer, chat, messages, action.text, action.inputMode, unchanged);
    case "confirm_offer":
      return confirmOffer(deps, config, buyer, chat, messages, action.messageId, action.offerId);
    case "talk_to_human": {
      if (chat.mode === "human") return unchanged();
      const lastBuyerText = messages.findLast((m) => m.type === "buyer_text")?.text;
      const reply = humanRequestReply({ storefront: deps.storefront, buyerName: addressName(buyer.displayName), lastBuyerText });
      return commit(deps, chat, messages, reply);
    }
  }
}

async function openChat({ store, storefront }: PipelineDeps, buyer: Buyer): Promise<StoredChat> {
  const existing = await store.findChat(buyer.id);
  if (existing) return existing;
  return store.createChat(buyer.id, {
    type: "ai_text",
    text: greetingText(storefront),
    cta: "open_products",
  });
}

function view(
  chat: StoredChat,
  messages: ChatMessage[],
  extra: Pick<ChatView, "focus" | "notice"> = {},
): ChatView {
  return { messages, mode: chat.mode, suggestions: deriveSuggestions(messages, chat.mode), ...extra };
}

/** สินค้าที่ลูกค้าเห็นได้ (ไม่มีต้นทุน/ราคาพื้น/tier) — ที่เดียวที่แปลง Product → PublicProduct */
export function toPublicProducts(config: MerchantConfig): PublicProduct[] {
  return config.products.map(({ sku, name, listPrice }) => ({ sku, name, listPrice }));
}

/** สินค้าที่คุยกันล่าสุด: การ์ดสินค้า หรือการ์ดข้อเสนอ อันไหนมาทีหลัง */
function lastSku(messages: ChatMessage[]): string | null {
  const m = messages.findLast((x) => x.type === "product_card" || x.type === "offers");
  return m?.type === "product_card" || m?.type === "offers" ? m.sku : null;
}

async function pickProduct(
  { store }: PipelineDeps,
  config: MerchantConfig,
  chat: StoredChat,
  messages: ChatMessage[],
  sku: string,
  unchanged: () => ChatView,
): Promise<ChatView> {
  const product = toPublicProducts(config).find((p) => p.sku === sku);
  if (!product) return unchanged();
  const drafts: ChatMessageDraft[] = [{ type: "product_card", sku: product.sku, name: product.name, listPrice: product.listPrice }];
  // ส่งเรื่องให้เถ้าแก่แล้ว — เก็บการ์ดไว้ให้เถ้าแก่เห็น AI ไม่ตอบ
  if (chat.mode === "ai") {
    drafts.push({ type: "ai_text", text: productIntroText(product) });
  }
  const added = await store.appendMessages(chat.id, drafts);
  return view(chat, [...messages, ...added]);
}

async function send(
  deps: PipelineDeps,
  config: MerchantConfig,
  buyer: Buyer,
  chat: StoredChat,
  messages: ChatMessage[],
  raw: string,
  inputMode: "text" | "voice",
  unchanged: () => ChatView,
): Promise<ChatView> {
  const text = raw.trim();
  if (!text) return unchanged();
  const { store, storefront } = deps;

  const history = messages.filter((m) => m.type === "buyer_text").slice(-HISTORY_LIMIT).map((m) => m.text);
  // ข้อความลูกค้าบันทึกพร้อมคำตอบในคำสั่งเดียว (ประหยัด round trip) — ถ้าตอบไม่สำเร็จ หน้าจอคืนข้อความให้ส่งใหม่
  const buyerDraft: ChatMessageDraft = { type: "buyer_text", text, inputMode };
  const withBuyerText = (reply: Reply): Reply => ({ ...reply, messages: [buyerDraft, ...reply.messages] });
  const onlyBuyerText = async (target: StoredChat) =>
    view(target, [...messages, ...(await store.appendMessages(chat.id, [buyerDraft]))]);
  // ส่งเรื่องให้เถ้าแก่แล้ว — เก็บข้อความไว้ให้เถ้าแก่อ่าน AI ไม่ตอบ
  if (chat.mode === "human") return onlyBuyerText(chat);

  const products = toPublicProducts(config);
  const { intent } = await parseIntent(text, { products, lastSku: lastSku(messages), history }, deps.intentLlm);

  const openOffers = lastOffers(messages);
  const open = openOffers && !openOffers.confirmed ? openOffers : undefined;

  // "สั่ง 1,500 ชิ้น" / "จ่ายสด" ตรงกับข้อเสนอที่เพิ่งให้ไป → ชี้ไปข้อนั้น ไม่ต่อราคารอบใหม่
  const matched = open && !intent.injectionSuspected ? matchOpenOffer(intent, open) : undefined;
  if (open && matched) {
    const reply: Reply = { messages: [{ type: "ai_text", text: pickedOfferText(matched) }] };
    return commit(deps, chat, messages, withBuyerText(reply), undefined, { messageId: open.id, offerId: matched.id });
  }

  const buyerName = addressName(buyer.displayName);
  // ตัวนับต่ำกว่าพื้น/หลอกระบบ: บันทึกแบบ compare-and-set ถ้าอีกแท็บเปลี่ยนไปก่อน อ่านใหม่แล้วคิดใหม่
  let current = chat;
  let result = runDealEngine({ config, intent, state: current.negotiation, buyerName, messageText: text });
  for (let attempt = 1; !(await saveCounters(store, current, result.state)); attempt++) {
    if (attempt >= MAX_COUNTER_RETRIES) throw new Error("[pipeline] ตัวนับการต่อราคาชนกันซ้ำหลายรอบ");
    const fresh = await store.findChat(buyer.id);
    if (!fresh) throw new Error("[pipeline] แชตหายระหว่างตอบ");
    // อีกคำขอส่งเรื่องให้เถ้าแก่ไปแล้ว → AI ไม่ตอบ
    if (fresh.mode === "human") return onlyBuyerText(fresh);
    current = fresh;
    result = runDealEngine({ config, intent, state: current.negotiation, buyerName, messageText: text });
  }
  const reply = replyFor(result, {
    storefront,
    buyerName,
    product: products.find((p) => p.sku === intent.sku),
    requestedPrice: intent.requestedPrice,
    qty: intent.quantity,
    openOffers: open,
    asksCost: ASKS_COST.test(text),
  });
  const priced = result.kind === "offers" ? result.offers : result.kind === "accept_list" ? [result.offer] : undefined;

  return commit(deps, { ...current, negotiation: result.state }, messages, withBuyerText(reply), priced);
}

/** ตัวนับไม่เปลี่ยนก็ไม่ต้องเขียน */
function saveCounters(store: ChatStore, chat: StoredChat, next: NegotiationState): Promise<boolean> | true {
  const prev = chat.negotiation;
  if (prev.belowFloorCount === next.belowFloorCount && prev.injectionCount === next.injectionCount) return true;
  return store.setNegotiation(chat.id, prev, next);
}

/** ข้อเสนอที่ลูกค้าเลือกด้วยการพิมพ์ — ต้องไม่ต่อราคาและตรงกับข้อเดียวเท่านั้น */
function matchOpenOffer(intent: Intent, open: ChatMessageOf<"offers">): Offer | undefined {
  if (intent.requestedPrice !== null) return undefined;
  if (intent.intent !== "order" && intent.intent !== "negotiate_price") return undefined;
  if (intent.sku !== null && intent.sku !== open.sku) return undefined;

  const candidates =
    intent.paymentTermsRequestedDays === 0
      ? open.offers.filter((o) => o.lever === "cash" && (intent.quantity === null || intent.quantity === o.qty))
      : intent.quantity !== null
        ? open.offers.filter((o) => o.qty === intent.quantity)
        : [];
  return candidates.length === 1 ? candidates[0] : undefined;
}

/** บันทึกคำตอบ: ข้อความ, ข้อเสนอ+margin, เรื่องที่ส่งต่อ แล้วคืนหน้าจอใหม่ */
async function commit(
  { store }: PipelineDeps,
  chat: StoredChat,
  messages: ChatMessage[],
  reply: Reply,
  priced?: PricedOffer[],
  focus?: ChatView["focus"],
): Promise<ChatView> {
  const added = await store.appendMessages(chat.id, reply.messages);
  const offersMessage = added.find((m) => m.type === "offers");
  const { handoff } = reply;
  // เขียนที่ไม่ขึ้นต่อกัน ยิงพร้อมกัน
  await Promise.all([
    offersMessage && priced ? store.saveOffers(chat.id, offersMessage.id, offersMessage.sku, priced) : null,
    handoff ? store.createEscalation(chat.id, handoff.kind, handoff.brief) : null,
    handoff ? store.setMode(chat.id, "human") : null,
  ]);
  const next: StoredChat = handoff ? { ...chat, mode: "human" } : chat;
  return view(next, [...messages, ...added], focus && { focus });
}

async function confirmOffer(
  { store }: PipelineDeps,
  config: MerchantConfig,
  buyer: Buyer,
  chat: StoredChat,
  messages: ChatMessage[],
  messageId: string,
  offerId: Offer["id"],
): Promise<ChatView> {
  const rejected = () => view(chat, messages, { notice: "confirm_unavailable" });
  if (chat.mode === "human") return rejected();
  // ยืนยันได้เฉพาะการ์ดข้อเสนอล่าสุดของแชตนี้ที่ยังไม่ยืนยัน
  const target = lastOffers(messages);
  if (!target || target.id !== messageId || target.confirmed) return rejected();

  const stored = await store.findOffer(chat.id, messageId, offerId);
  if (!stored) return rejected();
  const product = config.products.find((p) => p.sku === stored.sku);
  const productName = product?.name ?? stored.sku;

  const order = await store.createOrder({ chatId: chat.id, buyerId: buyer.id, offerRowId: stored.rowId, productName });
  if (!order) return rejected();

  const confirmed: ChatMessage = { ...target, selectedId: offerId, confirmed: true };
  await store.updateMessage(chat.id, confirmed);
  const added = await store.appendMessages(chat.id, [
    { type: "buyer_text", text: `เลือกข้อ ${stored.offer.id} · ${stored.offer.label}`, inputMode: "text" },
    { type: "order_summary", orderId: order.orderId, offer: stored.offer, productName },
  ]);
  return view(chat, [...messages.map((m) => (m.id === confirmed.id ? confirmed : m)), ...added]);
}
