import "server-only";
import { formatBaht, formatQty } from "@/lib/format";
import type { EscalationKind, MerchantConfig, Product } from "./types";

type Brief = [string, string, string];

export type BriefContext = {
  config: MerchantConfig;
  buyerName: string;
  messageText: string;
  product?: Product;
  qty?: number;
  /** ราคาที่ลูกค้าขอ — null = ไม่ได้บอก (ห้ามแต่งราคาใส่ brief) */
  price?: number | null;
  /** มูลค่าดีลที่ใช้เทียบเกณฑ์ escalate */
  value?: number;
  /** offer = ทุกข้อเสนอถูกตัดเพราะยอดรวมเกิน — value คือยอดของข้อที่ถูกที่สุด */
  valueBasis?: "requested" | "list" | "floor" | "offer";
  /** ทางเลือกที่ลูกค้าปฏิเสธ (all_rejected) */
  rejected?: ("volume" | "cash" | "bundle")[];
};

const LEVER_NAME = { volume: "ซื้อเพิ่ม", cash: "จ่ายสด", bundle: "รับของแถม" } as const;

const BASIS_NOTE = { requested: "", list: " (ราคาขาย)", floor: " (คิดที่ราคาพื้น)", offer: "" } as const;

/** Deal Brief 3 บรรทัดให้เถ้าแก่ (SKILL §6.4 ข้อ 6) — หน้าเถ้าแก่เอามาต่อกันด้วย " · " */
export function buildBrief(reason: EscalationKind, ctx: BriefContext): Brief {
  const { config, buyerName, messageText, product, qty = 0, price = null } = ctx;
  const owner = config.ownerDisplayName;
  const quoted = messageText ? `"${messageText}"` : "ไม่มีรายละเอียดเพิ่ม";
  const productName = product?.name ?? "สินค้า";
  const atPrice = price !== null ? ` ที่ ${formatBaht(price)}` : "";

  switch (reason) {
    case "over_value":
      return [
        `${buyerName} ขอ${productName} ${formatQty(qty)} ชิ้น${atPrice}`,
        ctx.valueBasis === "offer"
          ? `ข้อเสนอที่ถูกที่สุดรวม ${formatBaht(ctx.value ?? 0)} เกินเกณฑ์ ${formatBaht(config.escalationDealValue)}`
          : `มูลค่าราว ${formatBaht(ctx.value ?? 0)}${BASIS_NOTE[ctx.valueBasis ?? "requested"]} เกินเกณฑ์ ${formatBaht(config.escalationDealValue)}`,
        decisionLine("AI ยังไม่เสนอราคา", product, qty, price),
      ];
    case "refund":
      return [`${buyerName} ขอคืนเงิน`, quoted, `AI ไม่รับปากเรื่องคืนเงิน รอ${owner}ตัดสิน`];
    case "complaint":
      return [`${buyerName} ร้องเรียน`, quoted, `AI ยังไม่รับปากอะไร รอ${owner}ตัดสิน`];
    case "below_floor_3x":
      return [
        `${buyerName} ยืนยันขอ${productName}${atPrice} ต่ำกว่าราคาพื้นครบ 3 รอบ`,
        `จำนวน ${formatQty(qty)} ชิ้น`,
        decisionLine("AI ยังไม่ลดตาม", product, qty, price),
      ];
    case "injection":
      return [`${buyerName} พยายามหลอกระบบซ้ำ`, quoted, "AI ไม่ทำตามและหยุดเสนอราคา"];
    case "all_rejected":
      return [
        `${buyerName} ไม่รับทุกทางเลือก (${(ctx.rejected ?? []).map((l) => LEVER_NAME[l]).join(" / ")})`,
        `ขอ${productName} ${formatQty(qty)} ชิ้น${atPrice}`,
        decisionLine("AI ไม่ลดเพิ่มเอง", product, qty, price),
      ];
  }
}

/**
 * บรรทัดช่วยเถ้าแก่ตัดสิน (หน้าเถ้าแก่เท่านั้น — brief ไม่ถูกส่งให้ลูกค้า):
 * ถ้ายอมราคาที่ลูกค้าขอ ร้านได้กำไรเท่าไหร่ และอยู่เหนือราคาพื้นไหม · ไม่รู้ราคา → บอกกำไรที่ราคาขาย
 */
export function decisionLine(status: string, product: Product | undefined, qty: number, price: number | null): string {
  if (!product || !(qty > 0)) return status;
  if (price === null) {
    return `${status} · ขายราคาปกติ ${formatBaht(product.listPrice)} ได้กำไร ${formatBaht((product.listPrice - product.unitCost) * qty)}`;
  }
  const profit = (price - product.unitCost) * qty;
  const verdict =
    price >= product.floorPrice ? "สูงกว่าราคาพื้น ยอมได้" : profit >= 0 ? "ต่ำกว่าราคาพื้น ไม่แนะนำ" : "ขาดทุน ไม่แนะนำ";
  return `${status} · ถ้ายอม ${formatBaht(price)} ${profit >= 0 ? "ได้กำไร" : "ขาดทุน"} ${formatBaht(Math.abs(profit))} (${verdict})`;
}
