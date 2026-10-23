import { formatBaht, formatQty } from "./format";
import type { EscalationKind, MerchantConfig, Product } from "./types";

type Brief = [string, string, string];

export type BriefContext = {
  config: MerchantConfig;
  buyerName: string;
  messageText: string;
  product?: Product;
  qty?: number;
  price?: number;
};

/** Deal Brief 3 บรรทัดให้เถ้าแก่ (SKILL §6.4 ข้อ 6) — หน้าเถ้าแก่เอามาต่อกันด้วย " · " */
export function buildBrief(reason: EscalationKind, ctx: BriefContext): Brief {
  const { config, buyerName, messageText, product, qty = 0, price = 0 } = ctx;
  const owner = config.ownerDisplayName;
  const quoted = messageText ? `"${messageText}"` : "ไม่มีรายละเอียดเพิ่ม";

  switch (reason) {
    case "over_value":
      return [
        `${buyerName} ขอ${product?.name ?? "สินค้า"} ${formatQty(qty)} ชิ้น ที่ ${formatBaht(price)}`,
        `มูลค่าราว ${formatBaht(qty * price)} เกินเกณฑ์ ${formatBaht(config.escalationDealValue)}`,
        "AI ยังไม่เสนอราคา",
      ];
    case "refund":
      return [`${buyerName} ขอคืนเงิน`, quoted, `AI ไม่รับปากเรื่องคืนเงิน รอ${owner}ตัดสิน`];
    case "complaint":
      return [`${buyerName} ร้องเรียน`, quoted, `AI ยังไม่รับปากอะไร รอ${owner}ตัดสิน`];
    case "below_floor_3x":
      return [
        `${buyerName} ยืนยันขอ${product?.name ?? "สินค้า"} ที่ ${formatBaht(price)} ต่ำกว่าราคาพื้นครบ 3 รอบ`,
        `จำนวน ${formatQty(qty)} ชิ้น`,
        "AI ยังไม่ลดตาม",
      ];
    case "injection":
      return [`${buyerName} พยายามหลอกระบบซ้ำ`, quoted, "AI ไม่ทำตามและหยุดเสนอราคา"];
  }
}
