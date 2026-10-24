// ต่อทุกชั้นของแชตลูกค้า: ข้อความ → Layer 1 (intent) → Layer 2 (Deal Engine) → Layer 3 (template / LLM + ตรวจตัวเลข) → เก็บลงที่เก็บ
// ตัวเลขราคาทุกตัวมาจาก Deal Engine · ยืนยันออเดอร์จากข้อเสนอที่ server เก็บไว้เท่านั้น
import "server-only";
import { isOwnerApproved } from "@/lib/chat/owner-approval";
import { infoTopics } from "@/lib/ai/info-topics";
import { fallbackIntent } from "@/lib/ai/fallback-intent";
import { parseIntent, type IntentLlm } from "@/lib/ai/intent";
import { writeOffersText, type ReplyWriter } from "@/lib/ai/responder";
import { saysNumber, type ReplyFacts } from "@/lib/ai/validator";
import type { ChatAction, ChatView } from "@/lib/chat/actions";
import {
  addressName,
  ambiguousOfferReply,
  competitorReply,
  greetingText,
  humanRequestReply,
  pickedOfferText,
  productIntroText,
  replyFor,
  type Reply,
} from "@/lib/chat/replies";
import { deriveSuggestions, isOfferCardExpired, lastOffers, OFFER_TTL_MS } from "@/lib/chat/suggestions";
import type { ChatMessage, ChatMessageDraft, ChatMessageOf, Offer, PublicProduct, Storefront } from "@/lib/chat/types";
import { runDealEngine } from "@/lib/deal-engine";
import { pickedLetter, rejectedLetters, rejectedLevers, type TradeLever } from "@/lib/deal-engine/rejections";
import { productImageUrl } from "@/lib/products/image-url";
import type { Intent, MerchantConfig, NegotiationState, PricedOffer } from "@/lib/deal-engine/types";
import type { Speaker, SpokenAudio } from "@/lib/voice/speaker";
import type { ChatStore, StoredChat } from "./store";

export type PipelineDeps = {
  store: ChatStore;
  storefront: Storefront;
  intentLlm: IntentLlm | null;
  /** เวลาปัจจุบัน (test ใส่เองได้) */
  now?: () => Date;
  /** เสียง AI (ElevenLabs) — null = ไม่มีคีย์ ตอบเป็นข้อความอย่างเดียว */
  speaker?: Speaker | null;
  /** รอเสียงได้นานสุดเท่านี้ ช้ากว่านี้ตอบเป็นข้อความแทน */
  voiceTimeoutMs?: number;
  /** LLM เรียบเรียงข้อความที่มากับข้อเสนอ — null/ไม่ใส่ = template อย่างเดียว */
  replyWriter?: ReplyWriter | null;
  replyTimeoutMs?: number;
};

/** คำตอบ + ฉบับสั้นของข้อความแรกไว้ตอบเป็นเสียง (LLM เขียน · ดู WrittenText) */
type Written = Reply & { spoken?: string };
/** คำตอบที่จะบันทึก + เสียงของข้อความ ai_voice (ตำแหน่งใน messages) */
type Outgoing = Reply & { voice?: { index: number; spoken: SpokenAudio } };

const DEFAULT_VOICE_TIMEOUT_MS = 5000;
export type Buyer = { id: string; displayName: string };

/** ข้อความก่อนหน้าที่ส่งให้ GPT เข้าใจบริบท */
const HISTORY_LIMIT = 6;
const MAX_COUNTER_RETRIES = 3;
/** ออเดอร์ของการ์ดนี้มีอยู่แล้ว + เก่ากว่านี้ = ครั้งก่อนบันทึกไม่ครบ (ไม่ใช่กดซ้อนพร้อมกัน) → ทำให้ครบ */
const RECOVER_ORDER_AFTER_MS = 10_000;
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
  extra: Pick<ChatView, "focus" | "notice" | "voice"> = {},
  now = new Date(),
): ChatView {
  return { chatId: chat.id, messages, mode: chat.mode, suggestions: deriveSuggestions(messages, chat.mode, now), ...extra };
}

const clock = (deps: PipelineDeps) => (deps.now ?? (() => new Date()))();

/** ข้อเสนอนี้ยังยืนยันได้ตามการตั้งค่าตอนนี้: ไม่ต่ำกว่าพื้น · ของแถมยังเปิดใช้ · ไม่เกินเกณฑ์มูลค่าดีล */
function stillValid(offer: Offer, product: MerchantConfig["products"][number], config: MerchantConfig): boolean {
  // เถ้าแก่อนุมัติเองแล้ว — ไม่ต้องผ่านราคาพื้น/เกณฑ์มูลค่าดีลของ AI (อายุการ์ด 24 ชม. ยังใช้เหมือนเดิม)
  if (isOwnerApproved(offer)) return true;
  const gift = offer.bundle;
  if (gift && !config.deadStock.some((d) => (gift.sku ? d.sku === gift.sku : d.name === gift.name))) return false;
  return offer.pricePerUnit >= product.floorPrice && offer.total <= config.escalationDealValue;
}

/**
 * การ์ดข้อเสนอล่าสุดที่ยังใช้ได้จริง: ยังไม่ยืนยัน ไม่เก่าเกิน 24 ชม. สินค้ายังเปิดให้ AI ขาย และทุกข้อยังยืนยันได้
 * ใช้ไม่ได้ = ไม่ชี้ไปการ์ดนั้น ไม่ชวนเลือก (ไม่งั้นลูกค้าวนกดยืนยันไม่ได้)
 */
function usableOffers(messages: ChatMessage[], config: MerchantConfig, now: Date): ChatMessageOf<"offers"> | undefined {
  const card = lastOffers(messages);
  if (!card || card.confirmed || isOfferCardExpired(card, now)) return undefined;
  const product = config.products.find((p) => p.sku === card.sku);
  if (!product || !card.offers.every((o) => stillValid(o, product, config))) return undefined;
  return card;
}

/** สินค้าที่ลูกค้าเห็นได้ (ไม่มีต้นทุน/ราคาพื้น/tier) — ที่เดียวที่แปลง Product → PublicProduct */
export function toPublicProducts(config: MerchantConfig): PublicProduct[] {
  return config.products.map(({ sku, name, listPrice, imagePath }) => {
    const imageUrl = productImageUrl(imagePath);
    return imageUrl ? { sku, name, listPrice, imageUrl } : { sku, name, listPrice };
  });
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
  // ข้อความลูกค้า + (ถ้าพูดมา) แปลงคำตอบเป็นเสียง — ทุกทางที่ AI ตอบผ่านตรงนี้
  const prepare = async (reply: Written): Promise<Outgoing> =>
    speakReply(deps, { ...reply, messages: [buyerDraft, ...reply.messages] }, inputMode);
  const onlyBuyerText = async (target: StoredChat) =>
    view(target, [...messages, ...(await store.appendMessages(chat.id, [buyerDraft]))]);
  // ส่งเรื่องให้เถ้าแก่แล้ว — เก็บข้อความไว้ให้เถ้าแก่อ่าน AI ไม่ตอบ
  if (chat.mode === "human") return onlyBuyerText(chat);

  const products = toPublicProducts(config);
  const started = Date.now();
  const parsed = await parseIntent(text, { products, lastSku: lastSku(messages), history }, deps.intentLlm);
  const parsedBy = parsed.source;
  let intent = parsed.intent;
  // ทางเลือกที่ลูกค้าปฏิเสธในการต่อรองรอบนี้ (หลังออเดอร์ล่าสุด) — ไม่เสนอซ้ำ ไม่ชี้ไปข้อนั้น
  const rejected = rejectionsSince(messages, text);
  const parsedAt = Date.now();

  const now = clock(deps);
  const open = usableOffers(messages, config, now);

  // อ้างราคาร้านอื่นอย่างเดียว ทั้งที่มีข้อเสนออยู่แล้ว → ไม่ลดตาม ชวนดูข้อเสนอเดิม (ไม่นับเป็นการต่อรองรอบใหม่)
  const competitorPrice = intent.competitorClaim?.price ?? null;
  // GPT อาจดึงจำนวนเดิมจากข้อความก่อนหน้ามาใส่ — จำนวนเท่ากับที่เสนอไปแล้วก็ไม่ใช่ข้อมูลใหม่
  const sameQty = intent.quantity === null || open?.offers.some((o) => o.qty === intent.quantity);
  // เฉพาะตอนต่อราคา/สั่งของสินค้าเดียวกัน — ขอคืนเงิน/ร้องเรียนที่บังเอิญอ้างราคาร้านอื่นต้องไปถึงเถ้าแก่
  const negotiating = intent.intent === "negotiate_price" || intent.intent === "order";
  const sameProduct = intent.sku === null || intent.sku === open?.sku;
  if (
    open &&
    negotiating &&
    sameProduct &&
    competitorPrice !== null &&
    intent.requestedPrice === null &&
    sameQty &&
    !intent.injectionSuspected
  ) {
    return commit(deps, chat, messages, await prepare(competitorReply(open, competitorPrice, storefront.ownerName)));
  }

  // "เอาข้อ B" → ชี้ไปข้อนั้น (ลูกค้ายังต้องกดยืนยันในการ์ดเอง) · มีราคาใหม่ = ต่อราคา ไม่ใช่เลือก
  const letter = open && !intent.injectionSuspected && intent.requestedPrice === null ? pickedLetter(text) : null;
  const lettered = letter ? open?.offers.find((o) => o.id === letter) : undefined;
  // "สั่ง 1,500 ชิ้น" / "จ่ายสด" ตรงกับข้อเสนอที่เพิ่งให้ไป → ชี้ไปข้อนั้น ไม่ต่อราคารอบใหม่
  const candidates = lettered
    ? [lettered]
    : open && !intent.injectionSuspected
      ? matchOpenOffer(intent, open).filter((o) => o.lever === "list" || !rejected.includes(o.lever))
      : [];
  if (open && candidates.length === 1) {
    const [matched] = candidates;
    const reply: Reply = { messages: [{ type: "ai_text", text: pickedOfferText(matched) }] };
    return commit(deps, chat, messages, await prepare(reply), undefined, { messageId: open.id, offerId: matched.id });
  }
  // ตรงหลายข้อ (เช่น B กับ C เป็น 1,000 ชิ้นทั้งคู่) → ถามว่าข้อไหน
  if (open && candidates.length > 1) return commit(deps, chat, messages, await prepare(ambiguousOfferReply(candidates)));


  const buyerName = addressName(buyer.displayName);
  const continued = continueAfterRejection(intent, rejected, messages, text, products);
  // ต่อรองรอบใหม่หลังลูกค้าปฏิเสธ — ข้อความเปิดไม่ทวนราคาที่ขอซ้ำ
  const afterRejection = continued !== intent;
  intent = continued;
  // ตัวนับต่ำกว่าพื้น/หลอกระบบ: บันทึกแบบ compare-and-set ถ้าอีกแท็บเปลี่ยนไปก่อน อ่านใหม่แล้วคิดใหม่
  let current = chat;
  let result = runDealEngine({ config, intent, state: current.negotiation, buyerName, messageText: text, rejectedLevers: rejected });
  for (let attempt = 1; !(await saveCounters(store, current, result.state)); attempt++) {
    if (attempt >= MAX_COUNTER_RETRIES) throw new Error("[pipeline] ตัวนับการต่อราคาชนกันซ้ำหลายรอบ");
    const fresh = await store.findChat(buyer.id);
    if (!fresh) throw new Error("[pipeline] แชตหายระหว่างตอบ");
    // อีกคำขอส่งเรื่องให้เถ้าแก่ไปแล้ว → AI ไม่ตอบ
    if (fresh.mode === "human") return onlyBuyerText(fresh);
    current = fresh;
    result = runDealEngine({ config, intent, state: current.negotiation, buyerName, messageText: text, rejectedLevers: rejected });
  }
  const engineAt = Date.now();
  const product = products.find((p) => p.sku === intent.sku);
  const template = replyFor(result, {
    storefront,
    buyerName,
    product,
    requestedPrice: intent.requestedPrice,
    qty: intent.quantity,
    openOffers: open,
    asksCost: ASKS_COST.test(text),
    competitorPrice,
    askedDiscount: intent.intent === "negotiate_price",
    afterRejection,
    // ถามข้อมูลทั่วไป: GPT บอกว่าเป็นคำถาม หรือกฎเจอเรื่องที่ร้านมีคำตอบ (ใช้เฉพาะตอนไม่ได้ต่อราคา — engine ตัดสินแล้ว)
    info: { asked: intent.intent === "ask_info", topics: infoTopics(text), answers: config.answers },
  });
  const priced = result.kind === "offers" ? result.offers : result.kind === "accept_list" ? [result.offer] : undefined;
  // LLM ได้แค่ตัวเลขที่ Deal Engine คิดแล้ว + ชื่อลูกค้า (ไม่ได้ข้อความดิบ) · ตรวจไม่ผ่านใช้ template
  const reply =
    result.kind === "offers"
      ? await writeOffersReply(deps, template, {
          buyerName,
          ownerName: storefront.ownerName,
          product,
          requestedPrice: intent.requestedPrice,
          qty: intent.quantity,
          // GPT ดึงราคาร้านอื่นจากข้อความก่อนหน้ามาได้ — พูดซ้ำทุกข้อความแปลก ให้พูดเฉพาะตอนลูกค้าพูดในข้อความนี้
          competitorPrice: competitorPrice !== null && saysNumber(text, competitorPrice) ? competitorPrice : null,
          offers: result.offers.map((p) => p.offer),
        })
      : template;
  console.info(
    `[chat] parse ${parsedAt - started} ms (${parsedBy}) · engine ${engineAt - parsedAt} ms · write ${Date.now() - engineAt} ms`,
  );

  try {
    return await commit(deps, { ...current, negotiation: result.state }, messages, await prepare(reply), priced);
  } catch (err) {
    // บันทึกคำตอบไม่สำเร็จ ลูกค้าจะส่งใหม่ — คืนตัวนับ ไม่งั้นรอบส่งใหม่ถูกนับซ้ำ (escalate เร็วเกินจริง)
    await Promise.resolve(saveCounters(store, { ...current, negotiation: result.state }, current.negotiation)).catch(() => false);
    throw err;
  }
}

/** แทนข้อความแรกของ AI (ที่มากับการ์ดข้อเสนอ) ด้วยข้อความที่ LLM เรียบเรียงและผ่านการตรวจตัวเลขแล้ว */
async function writeOffersReply(deps: PipelineDeps, reply: Reply, facts: ReplyFacts): Promise<Written> {
  const index = reply.messages.findIndex((m) => m.type === "ai_text");
  const draft = reply.messages[index];
  if (draft?.type !== "ai_text") return reply;
  const written = await writeOffersText(deps.replyWriter ?? null, facts, draft.text, { timeoutMs: deps.replyTimeoutMs });
  if (written.reason) console.warn(`[chat] ข้อความ LLM ไม่ผ่าน (${written.reason}) ใช้ template แทน`);
  const messages = [...reply.messages];
  messages[index] = { ...draft, text: written.text };
  return { ...reply, messages, ...(written.spoken && { spoken: written.spoken }) };
}

/** ตัวนับไม่เปลี่ยนก็ไม่ต้องเขียน */
function saveCounters(store: ChatStore, chat: StoredChat, next: NegotiationState): Promise<boolean> | true {
  const prev = chat.negotiation;
  if (prev.belowFloorCount === next.belowFloorCount && prev.injectionCount === next.injectionCount) return true;
  return store.setNegotiation(chat.id, prev, next);
}

/** ข้อเสนอเดิมที่ลูกค้าพิมพ์เลือก (ต้องไม่ต่อราคา) — 1 ข้อ = เลือกให้ · หลายข้อ = ถาม · ว่าง = ไม่ใช่การเลือก */
function matchOpenOffer(intent: Intent, open: ChatMessageOf<"offers">): Offer[] {
  if (intent.requestedPrice !== null) return [];
  if (intent.intent !== "order" && intent.intent !== "negotiate_price") return [];
  if (intent.sku !== null && intent.sku !== open.sku) return [];

  if (intent.paymentTermsRequestedDays === 0) {
    return open.offers.filter((o) => o.lever === "cash" && (intent.quantity === null || intent.quantity === o.qty));
  }
  return intent.quantity !== null ? open.offers.filter((o) => o.qty === intent.quantity) : [];
}

/** บันทึกคำตอบ: ข้อความ, ข้อเสนอ+margin, เรื่องที่ส่งต่อ แล้วคืนหน้าจอใหม่ */
async function commit(
  deps: PipelineDeps,
  chat: StoredChat,
  messages: ChatMessage[],
  reply: Outgoing,
  priced?: PricedOffer[],
  focus?: ChatView["focus"],
): Promise<ChatView> {
  const { store } = deps;
  const added = await store.appendMessages(chat.id, reply.messages);
  const offersMessage = added.find((m) => m.type === "offers");
  const { handoff } = reply;
  // เขียนที่ไม่ขึ้นต่อกัน ยิงพร้อมกัน
  try {
    await Promise.all([
      offersMessage && priced ? store.saveOffers(chat.id, offersMessage.id, offersMessage.sku, priced) : null,
      handoff ? store.escalate(chat.id, handoff.kind, handoff.brief) : null,
    ]);
  } catch (err) {
    // ถอนข้อความที่เพิ่งบันทึก — ไม่ทิ้งการ์ดข้อเสนอที่ยืนยันไม่ได้ / การ์ดส่งต่อที่ AI ยังตอบอยู่
    // และลูกค้าที่กดส่งใหม่จะไม่เห็นข้อความตัวเองซ้ำ
    await store.deleteMessages(chat.id, added.map((m) => m.id)).catch(() => {});
    throw err;
  }
  const next: StoredChat = handoff ? { ...chat, mode: "human" } : chat;
  const spoken = reply.voice && added[reply.voice.index];
  const voice = spoken && reply.voice
    ? {
        messageId: spoken.id,
        mimeType: reply.voice.spoken.mimeType,
        base64: Buffer.from(reply.voice.spoken.audio).toString("base64"),
      }
    : undefined;
  return view(next, [...messages, ...added], { ...(focus && { focus }), ...(voice && { voice }) }, clock(deps));
}

async function confirmOffer(
  { store, now = () => new Date() }: PipelineDeps,
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
  // ข้อเสนอเก่า หรือราคา/สินค้าเปลี่ยนไปแล้ว (เถ้าแก่ขึ้นราคาพื้น / ปิด AI สินค้านี้) → ยืนยันไม่ได้ ให้ขอข้อเสนอใหม่
  const expired = now().getTime() - Date.parse(stored.createdAt) > OFFER_TTL_MS;
  // + เถ้าแก่ปิดของแถมชิ้นนั้น / ลดเกณฑ์มูลค่าดีลลงหลังเสนอ → ข้อเสนอเก่ายืนยันเองไม่ได้ ให้ขอใหม่
  if (!product || expired || !stillValid(stored.offer, product, config)) return rejected();
  const productName = product.name;

  let order = await store.createOrder({
    chatId: chat.id,
    buyerId: buyer.id,
    offerRowId: stored.rowId,
    offerMessageId: messageId,
    productName,
    gift: stored.offer.bundle,
  });
  let confirmedOffer = stored.offer;
  if (!order) {
    // การ์ดนี้เป็นออเดอร์ไปแล้ว: ถ้าเป็นครั้งก่อนที่บันทึกใบสรุปไม่ครบ → แสดงใบสรุปของออเดอร์เดิมให้ครบ
    const existing = await store.findOrderForCard(chat.id, messageId);
    if (!existing || now().getTime() - Date.parse(existing.createdAt) < RECOVER_ORDER_AFTER_MS) return rejected();
    const original = await store.findOffer(chat.id, messageId, existing.letter);
    if (!original) return rejected();
    order = { orderId: existing.orderId };
    confirmedOffer = original.offer;
  }

  const confirmed: ChatMessage = { ...target, selectedId: confirmedOffer.id, confirmed: true };
  await store.updateMessage(chat.id, confirmed);
  const added = await store.appendMessages(chat.id, [
    { type: "buyer_text", text: `เลือกข้อ ${confirmedOffer.id} · ${confirmedOffer.label}`, inputMode: "text" },
    { type: "order_summary", orderId: order.orderId, offer: confirmedOffer, productName },
  ]);
  return view(chat, [...messages.map((m) => (m.id === confirmed.id ? confirmed : m)), ...added]);
}

/**
 * ลูกค้าพูดมา → ตอบเป็นเสียง (SKILL: ตอบตามแบบที่ลูกค้าใช้) — แปลงข้อความแรกของ AI เป็น ai_voice + transcript
 * เสียงล่ม/ช้าเกิน → แจ้ง voice_unavailable แล้วตอบเป็นข้อความ (Mobile-NoVoice) · ไม่มีคีย์เสียง → ข้อความเฉยๆ
 */
async function speakReply(deps: PipelineDeps, { spoken: short, ...reply }: Written, inputMode: "text" | "voice"): Promise<Outgoing> {
  if (inputMode !== "voice" || !deps.speaker) return reply;
  const index = reply.messages.findIndex((m) => m.type === "ai_text");
  if (index < 0) return reply;
  const draft = reply.messages[index];
  if (draft.type !== "ai_text") return reply;

  // ตัวหนังสือใต้เสียง = สิ่งที่พูดจริง
  const say = short ?? draft.text;
  const started = Date.now();
  try {
    const spoken = await withDeadline(deps.speaker.speak(say), deps.voiceTimeoutMs ?? DEFAULT_VOICE_TIMEOUT_MS);
    console.info(`[voice] tts ${Date.now() - started} ms · ${spoken.audio.byteLength} bytes`);
    const messages = [...reply.messages];
    messages[index] = { type: "ai_voice", durationSec: spoken.durationSec, transcript: say };
    return { ...reply, messages, voice: { index, spoken } };
  } catch (err) {
    console.warn(`[voice] tts ล่ม ตอบเป็นข้อความแทน (${Date.now() - started} ms): ${err instanceof Error ? err.message : err}`);
    const messages = [...reply.messages];
    messages.splice(index, 0, { type: "system", kind: "voice_unavailable" });
    return { ...reply, messages };
  }
}

function withDeadline<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`timeout ${ms}ms`)), ms);
  });
  return Promise.race([promise, deadline]).finally(() => clearTimeout(timer));
}


/** ข้อความลูกค้าหลังออเดอร์ล่าสุด (ต่อรองรอบใหม่หลังสั่งของ = เริ่มนับใหม่) */
function sinceLastOrder(messages: ChatMessage[]): ChatMessage[] {
  return messages.slice(messages.findLastIndex((m) => m.type === "order_summary") + 1);
}

/**
 * ทางเลือกที่ลูกค้าปฏิเสธ นับจากข้อความหลังออเดอร์ล่าสุด + ข้อความนี้
 * "ไม่เอาข้อ A" เทียบกับการ์ดที่ลูกค้าเห็นตอนพิมพ์ (ตัวอักษรเดียวกันอาจเป็นคนละทางในการ์ดถัดไป)
 */
function rejectionsSince(messages: ChatMessage[], current: string): TradeLever[] {
  const texts: string[] = [];
  const byLetter = new Set<TradeLever>();
  let card: ChatMessageOf<"offers"> | undefined;
  const readLetters = (text: string) => {
    for (const id of rejectedLetters(text)) {
      const lever = card?.offers.find((o) => o.id === id)?.lever;
      if (lever && lever !== "list") byLetter.add(lever);
    }
  };
  for (const m of sinceLastOrder(messages)) {
    if (m.type === "offers") card = m;
    if (m.type === "buyer_text") {
      texts.push(m.text);
      readLetters(m.text);
    }
  }
  readLetters(current);
  const found = new Set<TradeLever>([...rejectedLevers([...texts, current]), ...byLetter]);
  return (["volume", "cash", "bundle"] as const).filter((l) => found.has(l));
}

/** ราคาต่อชิ้นล่าสุดที่ลูกค้าขอในรอบต่อรองนี้ — "ไม่ซื้อเพิ่ม" ไม่ได้แปลว่าเลิกขอราคานั้น */
function lastAskedPrice(messages: ChatMessage[], products: PublicProduct[], sku: string): number | null {
  for (const m of sinceLastOrder(messages).reverse()) {
    if (m.type !== "buyer_text") continue;
    const price = fallbackIntent(m.text, { products, lastSku: sku }).requestedPrice;
    if (price !== null) return price;
  }
  return null;
}

/**
 * "ไม่ซื้อเพิ่ม" / "ไม่เอาของแถม" / "จ่ายสดลดได้ไหม" ต่อจากการ์ดข้อเสนอ — ข้อความสั้นแบบนี้มักไม่มีสินค้า/จำนวน/ราคา
 * ใช้สินค้า จำนวนจากการ์ดล่าสุด และราคาที่ลูกค้าขอไว้ แล้วต่อรองรอบใหม่โดยตัดข้อที่ปฏิเสธ (ไม่ถามซ้ำ)
 * ราคาที่ขอต้องตามมาด้วย ไม่งั้นข้อของแถมคิดจากราคาพื้น → ปฏิเสธแล้วได้ราคาดีขึ้นเอง (ลดฟรี)
 */
function continueAfterRejection(
  intent: Intent,
  rejected: TradeLever[],
  messages: ChatMessage[],
  text: string,
  products: PublicProduct[],
): Intent {
  if (intent.injectionSuspected || intent.intent === "refund" || intent.intent === "complaint" || intent.intent === "ask_info") {
    return intent;
  }
  const card = lastOffers(messages);
  if (!card || card.confirmed || (intent.sku !== null && intent.sku !== card.sku)) return intent;
  const rejectsNow = rejectedLevers([text]).length > 0 || rejectedLetters(text).length > 0;
  const negotiating = intent.intent === "negotiate_price" || intent.intent === "order";
  if (!(rejected.length > 0 && (rejectsNow || negotiating))) return intent;
  // จำนวนที่ลูกค้าขอ = จำนวนของข้อที่ไม่ใช่ "ซื้อเยอะ"
  const asked = card.offers.find((o) => o.lever !== "volume") ?? card.offers[0];
  return {
    ...intent,
    intent: "negotiate_price",
    sku: card.sku,
    quantity: intent.quantity ?? asked?.qty ?? null,
    requestedPrice: intent.requestedPrice ?? lastAskedPrice(messages, products, card.sku),
  };
}
