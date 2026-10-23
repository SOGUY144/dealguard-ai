// ChatStore ในหน่วยความจำ — ใช้กับ test (ข้อมูลหายเมื่อปิดโปรแกรม)
import "server-only";
import type { Brief, HandoffKind } from "@/lib/chat/replies";
import type { ChatMessage, ChatMessageDraft, Offer } from "@/lib/chat/types";
import type { MerchantConfig, NegotiationState, PricedOffer } from "@/lib/deal-engine/types";
import type { ChatStore, StoredChat, StoredOffer } from "./store";

type OfferRow = StoredOffer & { chatId: string; messageId: string; economics: PricedOffer["economics"] };

export class MemoryChatStore implements ChatStore {
  readonly chats: StoredChat[] = [];
  readonly messages = new Map<string, ChatMessage[]>();
  readonly offers: OfferRow[] = [];
  readonly orders: {
    id: string;
    chatId: string;
    buyerId: string;
    offerRowId: string;
    offerMessageId: string;
    productName: string;
    createdAt: string;
  }[] = [];
  /** สต๊อกของแถมคงเหลือตาม sku (เริ่มจาก config) */
  readonly giftStock = new Map<string, number>();
  readonly escalations: { chatId: string; kind: HandoffKind; brief: Brief; status: "open" | "resolved" }[] = [];
  private seq = 0;
  private clock: number;

  constructor(
    private readonly config: MerchantConfig,
    startAt = Date.now(),
  ) {
    this.clock = startAt;
    for (const d of config.deadStock) this.giftStock.set(d.sku, d.qtyAvailable);
  }

  private nextId(prefix: string) {
    return `${prefix}${++this.seq}`;
  }

  async loadConfig() {
    return this.config;
  }

  async findChat(buyerId: string) {
    const chat = this.chats.findLast((c) => c.buyerId === buyerId);
    return chat ? structuredClone(chat) : null;
  }

  async createChat(buyerId: string, greeting: ChatMessageDraft) {
    const existing = this.chats.find((c) => c.buyerId === buyerId);
    if (existing) return structuredClone(existing);
    const chat: StoredChat = {
      id: this.nextId("chat"),
      buyerId,
      mode: "ai",
      negotiation: { belowFloorCount: 0, injectionCount: 0 },
    };
    this.chats.push(chat);
    this.messages.set(chat.id, []);
    await this.appendMessages(chat.id, [greeting]);
    return structuredClone(chat);
  }

  async listMessages(chatId: string) {
    return structuredClone(this.messages.get(chatId) ?? []);
  }

  async appendMessages(chatId: string, drafts: ChatMessageDraft[]) {
    const list = this.messages.get(chatId);
    if (!list) throw new Error(`ไม่มีแชต ${chatId}`);
    const added = drafts.map(
      (d) => ({ ...d, id: this.nextId("m"), at: new Date((this.clock += 1000)).toISOString() }) as ChatMessage,
    );
    list.push(...added);
    return structuredClone(added);
  }

  async updateMessage(chatId: string, message: ChatMessage) {
    const list = this.messages.get(chatId) ?? [];
    const i = list.findIndex((m) => m.id === message.id);
    if (i >= 0) list[i] = structuredClone(message);
  }

  async deleteMessages(chatId: string, ids: string[]) {
    const list = this.messages.get(chatId);
    if (!list) return;
    this.messages.set(
      chatId,
      list.filter((m) => !ids.includes(m.id)),
    );
    // การ์ดข้อเสนอถูกถอน → ข้อเสนอของการ์ดนั้นหายไปด้วย (เหมือน on delete cascade)
    for (let i = this.offers.length - 1; i >= 0; i--) if (ids.includes(this.offers[i].messageId)) this.offers.splice(i, 1);
  }

  async findOrderForCard(chatId: string, offerMessageId: string) {
    const order = this.orders.find((o) => o.chatId === chatId && o.offerMessageId === offerMessageId);
    const offer = order && this.offers.find((o) => o.rowId === order.offerRowId);
    return order && offer ? { orderId: order.id, letter: offer.offer.id, createdAt: order.createdAt } : null;
  }

  async setMode(chatId: string, mode: StoredChat["mode"]) {
    const chat = this.chats.find((c) => c.id === chatId);
    if (chat) chat.mode = mode;
  }

  async setNegotiation(chatId: string, expected: NegotiationState, next: NegotiationState) {
    const chat = this.chats.find((c) => c.id === chatId);
    if (!chat) return false;
    const same =
      chat.negotiation.belowFloorCount === expected.belowFloorCount &&
      chat.negotiation.injectionCount === expected.injectionCount;
    if (same) chat.negotiation = { ...next };
    return same;
  }

  async saveOffers(chatId: string, messageId: string, sku: string, priced: PricedOffer[]) {
    for (const { offer, economics } of priced) {
      this.offers.push({
        rowId: this.nextId("offer"),
        chatId,
        messageId,
        sku,
        offer: structuredClone(offer),
        economics,
        createdAt: new Date().toISOString(),
      });
    }
  }

  async findOffer(chatId: string, messageId: string, letter: Offer["id"]) {
    const row = this.offers.find((o) => o.chatId === chatId && o.messageId === messageId && o.offer.id === letter);
    return row ? { rowId: row.rowId, sku: row.sku, offer: structuredClone(row.offer), createdAt: row.createdAt } : null;
  }

  async createOrder(input: Parameters<ChatStore["createOrder"]>[0]) {
    const { gift, ...order } = input;
    const taken = this.orders.some((o) => o.offerRowId === order.offerRowId || o.offerMessageId === order.offerMessageId);
    if (taken) return null;
    if (gift) {
      const sku = gift.sku ?? this.config.deadStock.find((d) => d.name === gift.name)?.sku ?? gift.name;
      const left = this.giftStock.get(sku) ?? 0;
      if (left < gift.qty) return null;
      this.giftStock.set(sku, left - gift.qty);
    }
    const id = this.nextId("order");
    this.orders.push({ id, ...order, createdAt: new Date().toISOString() });
    return { orderId: id };
  }

  async escalate(chatId: string, kind: HandoffKind, brief: Brief) {
    this.escalations.push({ chatId, kind, brief: [...brief], status: "open" });
    await this.setMode(chatId, "human");
  }

  async resolveEscalations(chatId: string) {
    for (const e of this.escalations) if (e.chatId === chatId) e.status = "resolved";
  }

  async getChat(chatId: string) {
    const chat = this.chats.find((c) => c.id === chatId);
    return chat ? structuredClone(chat) : null;
  }
}
