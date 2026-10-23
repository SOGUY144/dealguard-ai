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
  readonly orders: { id: string; chatId: string; buyerId: string; offerRowId: string; productName: string }[] = [];
  readonly escalations: { chatId: string; kind: HandoffKind; brief: Brief }[] = [];
  private seq = 0;
  private clock: number;

  constructor(
    private readonly config: MerchantConfig,
    startAt = Date.parse("2026-10-23T07:30:00Z"),
  ) {
    this.clock = startAt;
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
      this.offers.push({ rowId: this.nextId("offer"), chatId, messageId, sku, offer: structuredClone(offer), economics });
    }
  }

  async findOffer(chatId: string, messageId: string, letter: Offer["id"]) {
    const row = this.offers.find((o) => o.chatId === chatId && o.messageId === messageId && o.offer.id === letter);
    return row ? { rowId: row.rowId, sku: row.sku, offer: structuredClone(row.offer) } : null;
  }

  async createOrder(input: { chatId: string; buyerId: string; offerRowId: string; productName: string }) {
    if (this.orders.some((o) => o.offerRowId === input.offerRowId)) return null;
    const id = this.nextId("order");
    this.orders.push({ id, ...input });
    return { orderId: id };
  }

  async createEscalation(chatId: string, kind: HandoffKind, brief: Brief) {
    this.escalations.push({ chatId, kind, brief: [...brief] });
  }
}
