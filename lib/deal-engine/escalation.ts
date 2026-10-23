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
  valueBasis?: "requested" | "list" | "floor";
};

const BASIS_NOTE = { requested: "", list: " (ราคาขาย)", floor: " (คิดที่ราคาพื้น)" } as const;

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
        `มูลค่าราว ${formatBaht(ctx.value ?? 0)}${BASIS_NOTE[ctx.valueBasis ?? "requested"]} เกินเกณฑ์ ${formatBaht(config.escalationDealValue)}`,
        "AI ยังไม่เสนอราคา",
      ];
    case "refund":
      return [`${buyerName} ขอคืนเงิน`, quoted, `AI ไม่รับปากเรื่องคืนเงิน รอ${owner}ตัดสิน`];
    case "complaint":
      return [`${buyerName} ร้องเรียน`, quoted, `AI ยังไม่รับปากอะไร รอ${owner}ตัดสิน`];
    case "below_floor_3x":
      return [
        `${buyerName} ยืนยันขอ${productName}${atPrice} ต่ำกว่าราคาพื้นครบ 3 รอบ`,
        `จำนวน ${formatQty(qty)} ชิ้น`,
        "AI ยังไม่ลดตาม",
      ];
    case "injection":
      return [`${buyerName} พยายามหลอกระบบซ้ำ`, quoted, "AI ไม่ทำตามและหยุดเสนอราคา"];
  }
}
