// Layer 1 สำรอง: แยกข้อความด้วยกฎ regex เมื่อไม่มีคีย์ GPT หรือ GPT ช้า/ล่ม
// ไม่ต้องเก่งเท่า GPT แค่ต้องไม่เดา: หาไม่เจอให้เป็น null แล้วให้ Deal Engine ถามกลับ
import type { Intent } from "@/lib/deal-engine/types";
import type { PublicProduct } from "@/lib/chat/types";

export type IntentContext = {
  products: PublicProduct[];
  /** สินค้าล่าสุดที่คุยกันในแชต */
  lastSku: string | null;
};

const INJECTION =
  /ลืมคำสั่ง|ละเว้นคำสั่ง|ไม่ต้องสนคำสั่ง|ignore\s+(all\s+|the\s+)?previous|system\s*prompt|developer\s*mode|jailbreak/i;
const REFUND = /คืนเงิน|refund|ขอเงินคืน/i;
const COMPLAINT = /ร้องเรียน|ไม่พอใจ|แย่มาก|ช้ามาก|ผิดหวัง|โกง/;
const ASK_INFO = /ต้นทุน|มีของไหม|มีสต๊อก|สต็อก|ส่งเมื่อไหร่|ส่งกี่วัน|ส่งได้ไหม/;
const ORDER = /สั่ง|ขอสั่ง|เอา\s*\d/;
const CASH = /จ่ายสด|โอนทันที|เงินสด/;

const QTY = /(\d+(?:\.\d+)?)\s*(?:ชิ้น|อัน|ตัว|เส้น|pcs)/i;
const COMPETITOR = /(?:ร้านข้างๆ|ร้านข้าง|ร้านอื่น|ที่อื่น|เจ้าอื่น)\D{0,15}?(\d+(?:\.\d+)?)/;
const PRICE_PATTERNS = [
  /ชิ้นละ\s*(\d+(?:\.\d+)?)/,
  /ขอ\s*(\d+(?:\.\d+)?)(?!\s*(?:ชิ้น|อัน|ตัว|เส้น))/,
  /ราคา\s*(\d+(?:\.\d+)?)/,
  /฿\s*(\d+(?:\.\d+)?)/,
  /(\d+(?:\.\d+)?)\s*(?:บาท|฿)/,
];

const num = (s: string | undefined) => (s === undefined ? null : Number(s));

export function fallbackIntent(raw: string, ctx: IntentContext): Intent {
  // "1,000" → "1000"
  const text = raw.replace(/(\d),(?=\d{3}\b)/g, "$1");

  const injectionSuspected = INJECTION.test(text);
  const competitorPrice = num(text.match(COMPETITOR)?.[1]);
  const quantity = num(text.match(QTY)?.[1]);

  let requestedPrice: number | null = null;
  for (const pattern of PRICE_PATTERNS) {
    const value = num(text.match(pattern)?.[1]);
    if (value !== null && value !== competitorPrice && value !== quantity) {
      requestedPrice = value;
      break;
    }
  }

  const intent: Intent["intent"] = REFUND.test(text)
    ? "refund"
    : COMPLAINT.test(text)
      ? "complaint"
      : ASK_INFO.test(text)
        ? "ask_info"
        : requestedPrice !== null || competitorPrice !== null
          ? "negotiate_price"
          : ORDER.test(text) && quantity !== null
            ? "order"
            : quantity !== null || CASH.test(text)
              ? "negotiate_price"
              : "other";

  const mentioned = ctx.products.find(
    (p) => text.includes(p.sku) || text.includes(p.name) || text.includes(p.name.split(" ")[0]),
  );
  const credit = text.match(/เครดิต\s*(\d+)\s*วัน/);

  // เรื่องคืนเงิน/ร้องเรียน ตัวเลขในประโยคไม่ใช่การสั่งซื้อ
  const dealing = intent === "negotiate_price" || intent === "order";
  return {
    intent,
    sku: mentioned?.sku ?? ctx.lastSku,
    requestedPrice: dealing ? requestedPrice : null,
    quantity: dealing ? quantity : null,
    paymentTermsRequestedDays: CASH.test(text) ? 0 : credit ? Number(credit[1]) : null,
    competitorClaim: competitorPrice !== null ? { mentioned: true, price: competitorPrice } : null,
    buyerName: null,
    injectionSuspected,
  };
}
