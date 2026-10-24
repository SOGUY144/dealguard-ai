// ตรวจข้อความที่ LLM เรียบเรียง (Layer 3) ก่อนถึงลูกค้า — SKILL §6.1: Layer 3 ห้ามเปลี่ยนตัวเลข
// LLM ตอบเป็นส่วนๆ (เปิด / ทีละข้อ / ปิด) แล้วระบบต่อเอง เพื่อผูกตัวเลขกับข้อของมัน:
// ข้อ B พูดได้แค่ตัวเลขของข้อ B · ประโยคเปิดพูดได้แค่สิ่งที่ลูกค้าขอ/ราคาร้านอื่น/ราคาปกติ · ไม่ผ่านข้อไหน pipeline ใช้ template
import type { Offer, PublicProduct } from "@/lib/chat/types";
import { thaiNumberWordsToDigits } from "./thai-numbers";

export type ReplyFacts = {
  /** ชื่อที่ใช้เรียกลูกค้า เช่น "คุณนก" */
  buyerName: string;
  ownerName: string;
  product?: PublicProduct;
  requestedPrice: number | null;
  qty: number | null;
  competitorPrice: number | null;
  offers: Offer[];
};

/** สิ่งที่ LLM เขียน — ตัวอักษรข้อ (A/B/C) ระบบใส่เอง */
export type ReplyDraft = { intro: string; options: { id: Offer["id"]; text: string }[]; closing: string };

export type Validation =
  | { ok: true }
  | {
      ok: false;
      reason:
        | "empty"
        | "options"
        | "forbidden"
        | "tone"
        | "no_name"
        | "too_long"
        | "offer_letter"
        | "competitor"
        | "request"
        | "claim"
        | "number_word"
        | `number:${string}`;
    };

/** ราว 60 คำไทย (ไม่มีเว้นวรรคระหว่างคำ จึงนับตัวอักษร) */
export const MAX_REPLY_CHARS = 280;

// สัญญาที่ไม่อยู่ในข้อเสนอ (SKILL §6.8) + ข้อมูลหลังบ้านที่ห้ามพูดถึง
const FORBIDDEN =
  /ส่งฟรี|ฟรีค่าส่ง|ค่าส่งฟรี|ไม่คิดค่าส่ง|รับประกัน|ประกันสินค้า|คืนเงิน|เงินคืน|เคลม|ต้นทุน|ราคาทุน|ราคาพื้น|กำไร|มาร์จิ้น|margin|floor|cost/i;
const FEMININE = /ค่ะ|คะ/;
// ตัวเลขที่เขียนเป็นคำแล้วแปลงไม่ได้ (เช่น "ห้าบาท") ตรวจค่าไม่ได้ — ไม่ให้ผ่าน
const NUMBER_WORD = /(?:หนึ่ง|สอง|สาม|สี่|ห้า|หก|เจ็ด|แปด|เก้า|สิบ|ร้อย|พัน|หมื่น|แสน|ล้าน)\s*(?:บาท|ชิ้น|%|เปอร์เซ็น|วัน|อัน|เส้น|ตัว)/;
const OFFER_LETTER = /ข้อ\s*[A-Za-z]\b/;
// เรื่องที่ GPT ชอบพูดเองทั้งที่ไม่เกิดขึ้น (วัดจริง 24 ต.ค. 2569)
const MENTIONS_COMPETITOR = /ร้านอื่น|ร้านข้าง|ที่อื่น|เจ้าอื่น|แพลตฟอร์ม/;
const MENTIONS_REQUEST = /ราคาที่(?:ขอ|เสนอ|ต้องการ)|ที่ขอมา/;
const CLAIMS_ACTION = /แจ้ง|ส่งเรื่อง|ปรึกษา|อนุมัติ|ถามเฮีย|ถามเจ้าของ/;

export function assembleReply(draft: ReplyDraft): string {
  const options = draft.options.map((o) => `ข้อ ${o.id} ${o.text.trim()}`).join(" · ");
  return [draft.intro.trim(), options, draft.closing.trim()].filter(Boolean).join(" ");
}

/** เลขไทย / ตัวเลขเป็นคำ / คอมม่าหลักพัน → เลขอารบิกล้วน */
function normalize(text: string): string {
  return thaiNumberWordsToDigits(text)
    .replace(/[๐-๙]/g, (d) => String(d.charCodeAt(0) - 0x0e50))
    .replace(/(\d),(?=\d{3}(?!\d))/g, "$1");
}

function numbersIn(text: string): number[] {
  return (normalize(text).match(/\d+(?:\.\d+)?/g) ?? []).map(Number);
}

/** ข้อความนี้พูดตัวเลขนี้เองไหม (รองรับเลขไทย / คำ / คอมม่า) */
export function saysNumber(text: string, n: number): boolean {
  return numbersIn(text).includes(n);
}

function numberSet(values: (number | null | undefined)[], texts: string[]): Set<number> {
  const set = new Set<number>();
  for (const n of [...values, ...texts.flatMap(numbersIn)]) {
    if (n == null) continue;
    set.add(n);
    set.add(Math.round(n));
    set.add(Math.ceil(n));
  }
  return set;
}

function offerNumbers(offer: Offer, productName: string): Set<number> {
  return numberSet(
    [offer.pricePerUnit, offer.total, offer.qty, offer.creditDays, offer.bundle?.qty],
    [offer.label, offer.conditionText, offer.bundle?.name ?? "", productName],
  );
}

/** ประโยคเปิด: ทวนสิ่งที่ลูกค้าขอ/อ้าง + บอกว่ามีกี่ทาง — ไม่พูดราคาข้อเสนอ */
function introNumbers(facts: ReplyFacts, productName: string): Set<number> {
  return numberSet(
    [facts.requestedPrice, facts.qty, facts.competitorPrice, facts.product?.listPrice, facts.offers.length],
    [productName],
  );
}

function checkNumbers(text: string, allowed: Set<number>, where: string): Validation {
  if (NUMBER_WORD.test(normalize(text))) return { ok: false, reason: "number_word" };
  for (const n of numbersIn(text)) {
    if (!allowed.has(n)) return { ok: false, reason: `number:${where}:${n}` };
  }
  return { ok: true };
}

export function validateDraft(draft: ReplyDraft, facts: ReplyFacts): Validation {
  const parts = [draft.intro, ...draft.options.map((o) => o.text), draft.closing];
  if (parts.some((p) => !p?.trim())) return { ok: false, reason: "empty" };
  const ids = draft.options.map((o) => o.id).join();
  if (ids !== facts.offers.map((o) => o.id).join()) return { ok: false, reason: "options" };

  const text = assembleReply(draft);
  if (FORBIDDEN.test(text)) return { ok: false, reason: "forbidden" };
  if (!text.includes("ครับ") || FEMININE.test(text)) return { ok: false, reason: "tone" };
  if (!draft.intro.includes(facts.buyerName)) return { ok: false, reason: "no_name" };
  if (text.length > MAX_REPLY_CHARS) return { ok: false, reason: "too_long" };
  if (parts.some((p) => OFFER_LETTER.test(p))) return { ok: false, reason: "offer_letter" };
  if (facts.competitorPrice === null && MENTIONS_COMPETITOR.test(text)) return { ok: false, reason: "competitor" };
  if (facts.requestedPrice === null && MENTIONS_REQUEST.test(text)) return { ok: false, reason: "request" };
  if (CLAIMS_ACTION.test(text)) return { ok: false, reason: "claim" };

  const productName = facts.product?.name ?? "";
  const checks = [
    checkNumbers(draft.intro, introNumbers(facts, productName), "intro"),
    ...draft.options.map((o) => checkNumbers(o.text, offerNumbers(facts.offers.find((x) => x.id === o.id)!, productName), o.id)),
    checkNumbers(draft.closing, numberSet([facts.offers.length], []), "closing"),
  ];
  return checks.find((c) => !c.ok) ?? { ok: true };
}
