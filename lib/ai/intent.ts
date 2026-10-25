// Layer 1: แปลงข้อความลูกค้าเป็น Intent JSON (SKILL §6.1, §6.3) — ไม่ตัดสินอะไร ไม่คิดราคา
// GPT ช้า/ล่ม/ตอบผิดรูปแบบ → ใช้ fallbackIntent แทน ลูกค้าต้องได้คำตอบเสมอ
import { z } from "zod";
import type { PublicProduct } from "@/lib/chat/types";
import type { Intent } from "@/lib/deal-engine/types";
import { ASKS_BOT, fallbackIntent, PRICE_QUESTION } from "./fallback-intent";

/** รูปแบบที่ GPT ต้องตอบ (snake_case ตาม SKILL §6.3) — ค่าที่ไม่รู้ต้องเป็น null ห้ามเดา */
export const llmIntentSchema = z.object({
  intent: z.enum(["negotiate_price", "ask_info", "order", "complaint", "refund", "other"]),
  sku: z.string().nullable(),
  requested_price: z.number().positive().nullable(),
  quantity: z.number().int().positive().nullable(),
  payment_terms_requested_days: z.number().int().min(0).nullable(),
  competitor_price: z.number().positive().nullable(),
  injection_suspected: z.boolean(),
  /** งบรวมที่ลูกค้าบอก ("320 บาทได้กี่เส้น") */
  budget_total: z.number().positive().nullable(),
  /** ลูกค้าหงุดหงิด/บ่นว่าตอบไม่ดี */
  frustrated: z.boolean(),
});
export type LlmIntentOutput = z.infer<typeof llmIntentSchema>;
/** ช่องที่เพิ่มทีหลังอาจไม่มี (โมเดล/ตัวทดสอบเก่า) — ไม่มีไม่ใช่เหตุให้ทิ้งผลของ GPT */
const llmIntentReader = llmIntentSchema.partial({ budget_total: true, frustrated: true });

export type IntentLlmInput = {
  text: string;
  /** ข้อความก่อนหน้าของลูกค้า (ล่าสุดอยู่ท้าย) ให้เข้าใจบริบท เช่น จำนวนที่บอกไปแล้ว */
  history: string[];
  /** ส่งแค่ sku + ชื่อ — ห้ามมีต้นทุน/ราคาพื้นใน prompt (SKILL §6.8) */
  products: { sku: string; name: string }[];
};

export interface IntentLlm {
  extract(input: IntentLlmInput): Promise<unknown>;
}

export type ParsedIntent = { source: "llm" | "fallback"; intent: Intent };

export type IntentParseContext = { products: PublicProduct[]; lastSku: string | null; history: string[] };

const DEFAULT_TIMEOUT_MS = 4000;
/** ถามต้นทุน = คำถามข้อมูล (ตอบว่าเป็นความลับ) ไม่ใช่ถามราคา */
const ASKS_COST = /ต้นทุน|ทุนเท่า|ราคาทุน|ราคาพื้น|กำไร/;
/** คำที่บอกว่าลูกค้าขอราคานั้นเอง ไม่ใช่แค่เล่าราคาร้านอื่น */
const ASKS_FOR_PRICE = /ขอ|ได้ไหม|ได้มั้ย|ได้ป่าว|ได้รึเปล่า|เหลือ|ลดเป็น/;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Layer 1 timeout ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

export async function parseIntent(
  text: string,
  ctx: IntentParseContext,
  llm: IntentLlm | null,
  { timeoutMs = DEFAULT_TIMEOUT_MS }: { timeoutMs?: number } = {},
): Promise<ParsedIntent> {
  const fallback = fallbackIntent(text, { products: ctx.products, lastSku: ctx.lastSku });
  if (!llm) return { source: "fallback", intent: fallback };

  try {
    const raw = await withTimeout(
      llm.extract({ text, history: ctx.history, products: ctx.products.map(({ sku, name }) => ({ sku, name })) }),
      timeoutMs,
    );
    const out = llmIntentReader.parse(raw);
    const known = ctx.products.some((p) => p.sku === out.sku);
    // "ลด 10 บาท" / "ขอ 10%" คือส่วนลดที่ขอ ไม่ใช่ราคาต่อชิ้น — GPT ใส่มาเป็น requested_price ได้
    const asked = out.requested_price;
    const budget = out.budget_total ?? fallback.budgetTotal ?? null;
    const discountOnly =
      asked !== null &&
      (new RegExp(String.raw`ลด(?:ให้)?\s*${asked}(?![\d.])`).test(text) ||
        new RegExp(String.raw`(?<![\d.])${asked}\s*(?:%|เปอร์เซ็น)`).test(text));
    return {
      source: "llm",
      intent: {
        // คืนเงิน/ร้องเรียนต้องถึงเถ้าแก่เสมอ — GPT อ่านพลาดเป็นต่อราคา กฎของเรายังจับได้
        // ถามเรื่องราคา ("มีราคาอื่นไหม") ที่ GPT จัดเป็นคำถามข้อมูล → ถามราคา (แชตจริงเคยตอบว่า "ผู้ช่วยยังตอบไม่ได้")
        intent:
          fallback.intent === "refund" || fallback.intent === "complaint"
            ? fallback.intent
            : out.intent === "ask_info" && PRICE_QUESTION.test(text) && !ASKS_COST.test(text)
              ? "negotiate_price"
              : out.intent,
        sku: known ? out.sku : ctx.lastSku,
        // GPT ชอบเอาราคาคู่แข่งมาใส่เป็นราคาที่ขอ ("ร้านข้างๆ ให้ 110") — เท่ากันพอดีและไม่มีคำขอ = แค่อ้างราคาร้านอื่น
        // ("ร้านอื่นให้ 100 ขอ 100 ได้ไหม" ยังเป็นการขอราคา — ตัวนับต่ำกว่าพื้นต้องทำงาน)
        // งบรวมไม่ใช่ราคาต่อชิ้น ("320 บาทได้กี่เส้น" → GPT อาจใส่ 320 มาทั้งสองช่อง)
        requestedPrice:
          discountOnly ||
          (budget !== null && out.requested_price === budget) ||
          (out.requested_price !== null && out.requested_price === out.competitor_price && !ASKS_FOR_PRICE.test(text))
            ? null
            : out.requested_price,
        quantity: out.quantity,
        paymentTermsRequestedDays: out.payment_terms_requested_days,
        competitorClaim: out.competitor_price !== null ? { mentioned: true, price: out.competitor_price } : null,
        buyerName: null,
        // ด่านสองชั้น: GPT หรือกฎของเราจับได้ก็พอ · ยกเว้น "เป็นคนหรือบอท" ที่ GPT ติดธงเอง (GPT จริง 25 ต.ค. 2569)
        // — ไม่งั้นได้คำตอบ "ราคาล็อก" แทนบอกว่าเป็น AI · มีคำสั่งให้ลืมคำสั่งด้วย กฎของเรายังจับได้
        injectionSuspected: fallback.injectionSuspected || (out.injection_suspected && !ASKS_BOT.test(text)),
        ...(budget !== null && { budgetTotal: budget }),
        // ต่อราคาซ้ำๆ ("ลดอีกๆๆ") GPT มักติดธงหงุดหงิด → ตอนต่อราคาเชื่อเฉพาะคำบ่นในข้อความจริง (ไม่งั้นได้คำขอโทษแทนเรื่องราคา)
        ...((fallback.frustrated || (out.frustrated && out.intent !== "negotiate_price" && out.intent !== "order")) && {
          frustrated: true,
        }),
      },
    };
  } catch (err) {
    console.warn(`[layer1] fallback: ${err instanceof Error ? err.message : err}`);
    return { source: "fallback", intent: fallback };
  }
}
