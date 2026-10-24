// โหมดผู้ช่วยเถ้าแก่: เถ้าแก่วางข้อความลูกค้าจาก LINE ส่วนตัว (บอทเข้าไม่ได้) → ได้ข้อเสนอ + ข้อความพร้อมคัดลอกไปตอบเอง
// ใช้ Deal Engine ตัวเดียวกับแชตของร้าน (ราคาพื้น / ไม่ลดฟรี / ส่งให้เถ้าแก่ตัดสิน) · ไม่บันทึกอะไรลงฐานข้อมูล
import "server-only";
import { addressName, replyFor } from "@/lib/chat/replies";
import type { Offer, PublicProduct, Storefront } from "@/lib/chat/types";
import { runDealEngine } from "@/lib/deal-engine";
import { rejectedLevers } from "@/lib/deal-engine/rejections";
import type { Intent, MerchantConfig } from "@/lib/deal-engine/types";
import { formatBaht } from "@/lib/format";

/** ผลที่หน้าผู้ช่วยแสดง — profit เป็นตัวเลขหลังบ้าน (หน้าเถ้าแก่เท่านั้น) */
export type AssistResult = {
  /** ข้อความพร้อมคัดลอกไปส่งใน LINE (ว่าง = เถ้าแก่ต้องตัดสินเองก่อน) */
  replyText: string;
  offers: { offer: Offer; profit: number }[];
  /** เรื่องที่ AI ไม่ตัดสินเอง — 3 บรรทัดเหมือนการ์ดรอตัดสิน */
  decision: string[] | null;
  /** ข้อความที่ยังขาดข้อมูล เช่น ไม่รู้จำนวน */
  missing: "quantity" | "product" | null;
  productName: string | null;
};

const LINE_CTA = "สนใจข้อไหนตอบกลับมาได้เลยครับ";

/** ปุ่มยืนยัน/รายการสินค้าไม่มีใน LINE — เปลี่ยนเป็นให้ลูกค้าตอบกลับ */
const forLine = (text: string) =>
  text.replace(/ถ้าสนใจกดยืนยันได้เลยครับ|กดยืนยันได้เลยครับ/g, "ตอบกลับมายืนยันได้เลยครับ");

function offerLine(o: Offer): string {
  return `${o.id} · ${o.label} ${formatBaht(o.pricePerUnit)}/ชิ้น — ${o.conditionText} (รวม ${formatBaht(o.total)})`;
}

export function buildAssist(
  config: MerchantConfig,
  intent: Intent,
  text: string,
  { buyerName = "", products, storefront }: { buyerName?: string; products: PublicProduct[]; storefront: Storefront },
): AssistResult {
  const name = buyerName.trim() ? addressName(buyerName) : "";
  // วางทั้งบทสนทนาได้ — ทางเลือกที่ลูกค้าบอกว่าไม่เอาแล้วจะไม่ถูกเสนอซ้ำ
  const rejected = rejectedLevers(text.split(/\n+/));
  const result = runDealEngine({
    config,
    intent,
    state: { belowFloorCount: 0, injectionCount: 0 },
    buyerName: name || "ลูกค้า",
    messageText: text,
    rejectedLevers: rejected,
  });
  const product = products.find((p) => p.sku === intent.sku);
  const base = { decision: null, missing: null, offers: [], productName: product?.name ?? null } satisfies Partial<AssistResult>;

  if (result.kind === "escalate") {
    return { ...base, replyText: "", decision: [...result.brief] };
  }
  if (result.kind === "ask_product") {
    const names = products.map((p) => p.name).join(" / ");
    return { ...base, missing: "product", replyText: `สวัสดีครับ${name} สนใจสินค้าตัวไหนครับ ร้านมี ${names} ครับ` };
  }

  const reply = replyFor(result, {
    storefront,
    buyerName: name,
    product,
    requestedPrice: intent.requestedPrice,
    qty: intent.quantity,
    asksCost: /ต้นทุน|ราคาพื้น|กำไร/.test(text),
    competitorPrice: intent.competitorClaim?.price ?? null,
  });
  const intro = reply.messages.flatMap((m) => (m.type === "ai_text" ? [forLine(m.text)] : [])).join(" ");

  if (result.kind === "offers") {
    // ปัดเป็นบาท — มูลค่าเงินสดทำให้มีเศษสตางค์ (เถ้าแก่ดูภาพรวม ไม่ต้องละเอียดถึงสตางค์)
    const offers = result.offers.map(({ offer, economics }) => ({ offer, profit: Math.round(economics.marginOffer) }));
    return { ...base, offers, replyText: [intro, ...offers.map(({ offer }) => offerLine(offer)), LINE_CTA].join("\n") };
  }
  if (result.kind === "accept_list") {
    return { ...base, offers: [{ offer: result.offer.offer, profit: Math.round(result.offer.economics.marginOffer) }], replyText: intro };
  }
  return { ...base, missing: result.kind === "ask_quantity" ? "quantity" : null, replyText: intro };
}
