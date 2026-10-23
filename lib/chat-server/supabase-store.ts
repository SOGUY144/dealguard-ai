// ChatStore บน Supabase — เขียนด้วย service role (ข้าม RLS) จาก server เท่านั้น
// ฝั่งลูกค้าอ่านแชตของตัวเองผ่าน RLS ได้ แต่ offer_economics / escalations / products อ่านได้เฉพาะ owner
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Brief, HandoffKind } from "@/lib/chat/replies";
import type { ChatMessage, ChatMessageDraft, Offer } from "@/lib/chat/types";
import type { MerchantConfig, NegotiationState, PricedOffer } from "@/lib/deal-engine/types";
import type { ChatStore, StoredChat, StoredOffer } from "./store";

type Row = Record<string, unknown>;

/** error ของ Postgres ที่บอกว่าซ้ำ (unique) */
const UNIQUE_VIOLATION = "23505";

function must<T>(label: string, { data, error }: { data: T | null; error: { message: string } | null }): T {
  if (error) throw new Error(`[store] ${label}: ${error.message}`);
  return data as T;
}

const num = (v: unknown) => Number(v);

function toChat(row: Row): StoredChat {
  return {
    id: String(row.id),
    buyerId: String(row.buyer_id),
    mode: row.mode === "human" ? "human" : "ai",
    negotiation: { belowFloorCount: num(row.below_floor_count), injectionCount: num(row.injection_count) },
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
        .select("*")
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
        .select("*"),
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

  async setMode(chatId: string, mode: StoredChat["mode"]) {
    must("เปลี่ยนโหมดแชต", await this.db.from("chats").update({ mode }).eq("id", chatId));
  }

  async setNegotiation(chatId: string, expected: NegotiationState, next: NegotiationState) {
    // compare-and-set: แก้ได้เฉพาะแถวที่ตัวนับยังเท่าที่อ่านมา — ชนกันจะได้ 0 แถว
    const updated = must<Row[]>(
      "แก้ตัวนับการต่อราคา",
      await this.db
        .from("chats")
        .update({ below_floor_count: next.belowFloorCount, injection_count: next.injectionCount })
        .eq("id", chatId)
        .eq("below_floor_count", expected.belowFloorCount)
        .eq("injection_count", expected.injectionCount)
        .select("id"),
    );
    return updated.length > 0;
  }

  async saveOffers(chatId: string, messageId: string, sku: string, priced: PricedOffer[]) {
    const inserted = must<Row[]>(
      "เก็บข้อเสนอ",
      await this.db
        .from("offers")
        .insert(
          priced.map(({ offer }) => ({
            chat_id: chatId,
            message_id: messageId,
            letter: offer.id,
            lever: offer.lever,
            sku,
            label: offer.label,
            price_per_unit: offer.pricePerUnit,
            qty: offer.qty,
            condition_text: offer.conditionText,
            total: offer.total,
            credit_days: offer.creditDays,
            bundle: offer.bundle ?? null,
          })),
        )
        .select("id, letter"),
    );
    const idOf = new Map(inserted.map((r) => [String(r.letter), String(r.id)]));
    must(
      "เก็บ margin",
      await this.db.from("offer_economics").insert(
        priced.map(({ offer, economics }) => ({
          offer_id: idOf.get(offer.id),
          margin_if_conceded: economics.marginIfConceded,
          margin_offer: economics.marginOffer,
          recovered_margin: economics.recoveredMargin,
          bundle_cost: economics.bundleCost,
          cash_value: economics.cashValue,
        })),
      ),
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
    return row ? { rowId: String(row.id), sku: String(row.sku), offer: toOffer(row) } : null;
  }

  async createOrder(input: { chatId: string; buyerId: string; offerRowId: string; productName: string }) {
    const { data, error } = await this.db
      .from("orders")
      .insert({
        merchant_id: await this.merchantIdOf(),
        chat_id: input.chatId,
        buyer_id: input.buyerId,
        offer_id: input.offerRowId,
        product_name: input.productName,
      })
      .select("id")
      .single();
    if (error?.code === UNIQUE_VIOLATION) return null;
    if (error) throw new Error(`[store] สร้างออเดอร์: ${error.message}`);
    return { orderId: String(data.id) };
  }

  async createEscalation(chatId: string, kind: HandoffKind, brief: Brief) {
    must(
      "ส่งเรื่องให้เถ้าแก่",
      await this.db.from("escalations").insert({ merchant_id: await this.merchantIdOf(), chat_id: chatId, kind, brief }),
    );
  }
}
