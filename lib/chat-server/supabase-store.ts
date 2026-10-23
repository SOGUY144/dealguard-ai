// ChatStore บน Supabase — เขียนด้วย service role (ข้าม RLS) จาก server เท่านั้น
// ฝั่งลูกค้าอ่านแชตของตัวเองผ่าน RLS ได้ แต่ offer_economics / escalations / products อ่านได้เฉพาะ owner
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Brief, HandoffKind } from "@/lib/chat/replies";
import type { ChatMessage, ChatMessageDraft, Offer } from "@/lib/chat/types";
import type { MerchantConfig, NegotiationState, PricedOffer } from "@/lib/deal-engine/types";
import type { ChatStore, StoredChat, StoredOffer } from "./store";

type Row = Record<string, unknown>;

function must<T>(label: string, { data, error }: { data: T | null; error: { message: string } | null }): T {
  if (error) throw new Error(`[store] ${label}: ${error.message}`);
  return data as T;
}

const num = (v: unknown) => Number(v);

/** ตัวนับอยู่ตาราง chat_negotiation (owner อ่านได้คนเดียว) — embed มากับแชต */
const CHAT_COLUMNS = "*, chat_negotiation(below_floor_count, injection_count)";

function toChat(row: Row): StoredChat {
  const raw = row.chat_negotiation;
  const counters = (Array.isArray(raw) ? raw[0] : raw) as Row | null | undefined;
  return {
    id: String(row.id),
    buyerId: String(row.buyer_id),
    mode: row.mode === "human" ? "human" : "ai",
    negotiation: {
      belowFloorCount: num(counters?.below_floor_count ?? 0),
      injectionCount: num(counters?.injection_count ?? 0),
    },
  };
}

function toMessage(row: Row): ChatMessage {
  return {
    ...(row.body as object),
    id: String(row.id),
    at: new Date(String(row.created_at)).toISOString(),
    type: row.type,
  } as ChatMessage;
}

/** แยกส่วนที่เก็บใน body ออกจาก id/at/type */
function toBody(message: ChatMessageDraft | ChatMessage): Row {
  const rest: Row = { ...message };
  delete rest.type;
  delete rest.id;
  delete rest.at;
  return rest;
}

/** แถวในตาราง offers → Offer ที่ลูกค้าเห็นได้ */
export function toOffer(row: Row): Offer {
  return {
    id: row.letter as Offer["id"],
    lever: row.lever as Offer["lever"],
    label: String(row.label),
    pricePerUnit: num(row.price_per_unit),
    qty: num(row.qty),
    conditionText: String(row.condition_text),
    total: num(row.total),
    creditDays: num(row.credit_days),
    ...(row.bundle ? { bundle: row.bundle as Offer["bundle"] } : {}),
  };
}

export class SupabaseChatStore implements ChatStore {
  private merchantId: string | null = null;

  constructor(private readonly db: SupabaseClient) {}

  private config: Promise<MerchantConfig> | null = null;

  /** ร้านเดียวใน MVP: ร้านแรกที่สร้าง */
  private async merchantIdOf(): Promise<string> {
    if (this.merchantId) return this.merchantId;
    const row = must<Row>(
      "อ่านร้าน",
      await this.db.from("merchants").select("id").order("created_at").limit(1).single(),
    );
    this.merchantId = String(row.id);
    return this.merchantId;
  }

  /** ร้าน + สินค้า + ของค้างสต๊อก ในคำขอเดียว · store สร้างใหม่ทุก request จึงจำไว้ได้ทั้ง request */
  loadConfig(): Promise<MerchantConfig> {
    this.config ??= this.fetchConfig().catch((err) => {
      this.config = null;
      throw err;
    });
    return this.config;
  }

  private async fetchConfig(): Promise<MerchantConfig> {
    const shop = must<Row>(
      "อ่านร้าน",
      await this.db
        .from("merchants")
        .select("*, products(*), dead_stock(*)")
        // เถ้าแก่ปิด "ให้ AI ต่อราคาสินค้านี้" → ไม่แสดง ไม่เสนอราคา ไม่ยืนยันข้อเสนอเก่า
        .eq("products.ai_enabled", true)
        .order("created_at")
        .order("created_at", { referencedTable: "products" })
        .order("created_at", { referencedTable: "dead_stock" })
        .limit(1)
        .single(),
    );
    this.merchantId = String(shop.id);
    return {
      merchantName: String(shop.name),
      ownerDisplayName: String(shop.owner_display_name),
      costOfCapitalAnnual: num(shop.cost_of_capital_annual),
      escalationDealValue: num(shop.escalation_deal_value),
      bundleConcessionRatio: num(shop.bundle_concession_ratio),
      products: (shop.products as Row[]).map((p) => ({
        sku: String(p.sku),
        name: String(p.name),
        listPrice: num(p.list_price),
        unitCost: num(p.unit_cost),
        floorPrice: num(p.floor_price),
        volumeTiers: (p.volume_tiers as { minQty: number; price: number }[]).map((t) => ({
          minQty: num(t.minQty),
          price: num(t.price),
        })),
        cashDiscountPct: num(p.cash_discount_pct),
        defaultCreditDays: num(p.default_credit_days),
      })),
      deadStock: (shop.dead_stock as Row[]).map((d) => ({
        sku: String(d.sku),
        name: String(d.name),
        unitCost: num(d.unit_cost),
        perceivedValue: num(d.perceived_value),
        qtyAvailable: num(d.qty_available),
      })),
    };
  }

  async findChat(buyerId: string) {
    const row = must<Row | null>(
      "อ่านแชต",
      await this.db
        .from("chats")
        .select(CHAT_COLUMNS)
        .eq("buyer_id", buyerId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    );
    return row ? toChat(row) : null;
  }

  async createChat(buyerId: string, greeting: ChatMessageDraft) {
    const merchantId = await this.merchantIdOf();
    // ชนกับอีกคำขอที่สร้างไปก่อน (unique merchant_id + buyer_id) → ไม่ได้แถวกลับมา ใช้แชตเดิม
    const inserted = must<Row[]>(
      "สร้างแชต",
      await this.db
        .from("chats")
        .upsert({ merchant_id: merchantId, buyer_id: buyerId }, { onConflict: "merchant_id,buyer_id", ignoreDuplicates: true })
        .select(CHAT_COLUMNS),
    );
    if (inserted.length === 0) {
      const existing = await this.findChat(buyerId);
      if (!existing) throw new Error("[store] สร้างแชตไม่สำเร็จ");
      return existing;
    }
    const chat = toChat(inserted[0]);
    await this.appendMessages(chat.id, [greeting]);
    return chat;
  }

  async listMessages(chatId: string) {
    const rows = must<Row[]>(
      "อ่านข้อความ",
      await this.db.from("messages").select("*").eq("chat_id", chatId).order("seq"),
    );
    return rows.map(toMessage);
  }

  async appendMessages(chatId: string, drafts: ChatMessageDraft[]) {
    if (drafts.length === 0) return [];
    // ลำดับ (seq) กับเวลา (created_at) ออกโดยฐานข้อมูล · แถวในคำสั่งเดียวได้ seq เรียงตามลำดับที่ส่ง
    const rows = drafts.map((d) => ({
      chat_id: chatId,
      type: d.type,
      input_mode: d.type === "buyer_text" ? d.inputMode : null,
      body: toBody(d),
    }));
    const inserted = must<Row[]>("เพิ่มข้อความ", await this.db.from("messages").insert(rows).select("*"));
    return inserted.sort((a, b) => num(a.seq) - num(b.seq)).map(toMessage);
  }

  async updateMessage(chatId: string, message: ChatMessage) {
    must(
      "แก้ข้อความ",
      await this.db.from("messages").update({ body: toBody(message) }).eq("id", message.id).eq("chat_id", chatId),
    );
  }

  async deleteMessages(chatId: string, ids: string[]) {
    if (ids.length === 0) return;
    // ข้อเสนอของการ์ดที่ถูกถอนลบตาม (offers.message_id on delete cascade)
    must("ถอนข้อความ", await this.db.from("messages").delete().eq("chat_id", chatId).in("id", ids));
  }

  async findOrderForCard(chatId: string, offerMessageId: string) {
    const row = must<Row | null>(
      "อ่านออเดอร์ของการ์ด",
      await this.db
        .from("orders")
        .select("id, created_at, offers(letter)")
        .eq("chat_id", chatId)
        .eq("offer_message_id", offerMessageId)
        .maybeSingle(),
    );
    if (!row) return null;
    const offer = (Array.isArray(row.offers) ? row.offers[0] : row.offers) as Row | null;
    if (!offer) return null;
    return {
      orderId: String(row.id),
      letter: offer.letter as Offer["id"],
      createdAt: new Date(String(row.created_at)).toISOString(),
    };
  }

  async setMode(chatId: string, mode: StoredChat["mode"]) {
    must("เปลี่ยนโหมดแชต", await this.db.from("chats").update({ mode }).eq("id", chatId));
  }

  async setNegotiation(chatId: string, expected: NegotiationState, next: NegotiationState) {
    // compare-and-set: แก้ได้เฉพาะแถวที่ตัวนับยังเท่าที่อ่านมา — ชนกันจะได้ 0 แถว
    const updated = must<Row[]>(
      "แก้ตัวนับการต่อราคา",
      await this.db
        .from("chat_negotiation")
        .update({ below_floor_count: next.belowFloorCount, injection_count: next.injectionCount })
        .eq("chat_id", chatId)
        .eq("below_floor_count", expected.belowFloorCount)
        .eq("injection_count", expected.injectionCount)
        .select("chat_id"),
    );
    return updated.length > 0;
  }

  async saveOffers(chatId: string, messageId: string, sku: string, priced: PricedOffer[]) {
    // ข้อเสนอ + margin ใน transaction เดียว (RPC) — margin เขียนไม่ได้ ข้อเสนอก็ไม่ถูกเก็บ
    must(
      "เก็บข้อเสนอ",
      await this.db.rpc("save_offers", {
        p_chat: chatId,
        p_message: messageId,
        p_sku: sku,
        p_offers: priced.map(({ offer, economics }) => ({
          letter: offer.id,
          lever: offer.lever,
          label: offer.label,
          price_per_unit: offer.pricePerUnit,
          qty: offer.qty,
          condition_text: offer.conditionText,
          total: offer.total,
          credit_days: offer.creditDays,
          bundle: offer.bundle ?? null,
          margin_if_conceded: economics.marginIfConceded,
          margin_offer: economics.marginOffer,
          recovered_margin: economics.recoveredMargin,
          bundle_cost: economics.bundleCost,
          cash_value: economics.cashValue,
        })),
      }),
    );
  }

  async findOffer(chatId: string, messageId: string, letter: Offer["id"]): Promise<StoredOffer | null> {
    const row = must<Row | null>(
      "อ่านข้อเสนอ",
      await this.db
        .from("offers")
        .select("*")
        .eq("chat_id", chatId)
        .eq("message_id", messageId)
        .eq("letter", letter)
        .maybeSingle(),
    );
    return row
      ? {
          rowId: String(row.id),
          sku: String(row.sku),
          offer: toOffer(row),
          createdAt: new Date(String(row.created_at)).toISOString(),
        }
      : null;
  }

  async createOrder(input: Parameters<ChatStore["createOrder"]>[0]) {
    const { data, error } = await this.db.rpc("place_order", {
      p_chat: input.chatId,
      p_buyer: input.buyerId,
      p_offer: input.offerRowId,
      p_offer_message: input.offerMessageId,
      p_product_name: input.productName,
      p_gift_sku: input.gift?.sku ?? null,
      p_gift_name: input.gift?.name ?? null,
      p_gift_qty: input.gift?.qty ?? null,
    });
    // ของแถมไม่พอ → ยกเลิกทั้งออเดอร์ (ฟังก์ชันใน DB rollback ให้แล้ว)
    if (error?.message.includes("gift_out_of_stock")) return null;
    if (error) throw new Error(`[store] สร้างออเดอร์: ${error.message}`);
    return data ? { orderId: String(data) } : null;
  }

  async escalate(chatId: string, kind: HandoffKind, brief: Brief) {
    must("ส่งเรื่องให้เถ้าแก่", await this.db.rpc("escalate_chat", { p_chat: chatId, p_kind: kind, p_brief: brief }));
  }
}
