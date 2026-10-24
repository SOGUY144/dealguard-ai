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

// สัญญาที่ไม่อยู่ในข้อเสนอ (SKILL §6.8) + ข้อมูลหลังบ้านที่ห้ามพูดถึง (รีวิวรอบ 3 เพิ่มคำที่ยังหลุด)
const FORBIDDEN =
  /ประกัน|การันตี|warranty|guarantee|ฟรี|free|ค่าส่ง|ขนส่ง|จัดส่ง|ส่งให้|ส่งถึง|ส่งภายใน|ส่งด่วน|ส่งไว|ไม่คิดค่า|เปลี่ยนสินค้า|เปลี่ยนคืน|คืนสินค้า|รับคืน|คืนเงิน|เงินคืน|เคลม|ครึ่งราคา|ทุน|ลด(?:ให้)?อีก|ลดเพิ่ม|ราคาพื้น|กำไร|มาร์จิ้น|margin|floor|cost/i;
const FEMININE = /ค่ะ|คะ/;
// ตัวเลขที่เขียนเป็นคำแล้วแปลงไม่ได้ (เช่น "ห้าบาท", "ลดอีกห้า") ตรวจค่าไม่ได้ — ไม่ให้ผ่าน
const NUMBER_WORD = /หนึ่ง|สอง|สาม(?!ารถ)|สี่|ห้า(?!ง)|หก|เจ็ด|แปด|เก้า|สิบ|(?<!เรียบ)ร้อย(?!ละ)|พัน(?!ธ)|หมื่น|แสน|ล้าน/;
const OFFER_LETTER = /ข้อ\s*[A-Za-z]\b/;
// เรื่องที่ GPT ชอบพูดเองทั้งที่ไม่เกิดขึ้น (วัดจริง 24 ต.ค. 2569)
const MENTIONS_COMPETITOR = /ร้านอื่น|ร้านข้าง|ที่อื่น|เจ้าอื่น|แพลตฟอร์ม/;
const MENTIONS_REQUEST = /ราคาที่(?:ขอ|เสนอ|ต้องการ)|ที่ขอมา/;
const CLAIMS_ACTION = /แจ้ง|ส่งเรื่อง|ปรึกษา|อนุมัติ|ถามเฮีย|ถามเจ้าของ/;
// ประโยคเปิดห้ามตอบตกลงราคาที่ลูกค้าขอ / ราคาร้านอื่น — ยกเว้นมีข้อเสนอที่ได้ราคานั้นจริง
const AGREES = /(?<!ไม่)ได้ครับ|ยินดี|ตกลง|โอเค|จัดให้/;
const MATCHES_COMPETITOR = /เท่า(?:กับ)?(?:ร้าน|ที่อื่น|เจ้าอื่น)|ตามร้าน(?:อื่น|ข้าง)(?:ได้|เลย)/;
const REFUSES = /ไม่ไหว|ไม่ได้/;
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

/** บทบาทของตัวเลข: ราคาต่อชิ้น / ยอดรวม / จำนวนชิ้น / วันเครดิต / จำนวนทาง / เปอร์เซ็นต์ / วันอื่นๆ */
type Role = "price" | "total" | "count" | "credit" | "ways" | "percent" | "days";
type Mention = { value: number; role: Role };

/**
 * อ่านตัวเลขพร้อมบทบาทจากคำรอบๆ — ชื่อสินค้า/ของแถมตัดออกก่อน (เลขในชื่อ เช่น "1 เมตร", "20W" ไม่ใช่ราคา)
 * ตัวเลขเปล่าๆ ถือเป็นราคา (ต้องตรงราคาต่อชิ้นพอดี)
 */
function mentions(text: string, names: string[]): Mention[] {
  let t = normalize(text);
  for (const name of names) if (name.trim()) t = t.split(normalize(name)).join(" ");
  const out: Mention[] = [];
  const re = /(฿\s*)?(\d+(?:\.\d+)?)(\s*(?:บาท|ชิ้น|อัน|เส้น|ตัว|กล่อง|แพ็ค|วัน|ทาง|แบบ|ข้อ|%|เปอร์เซ็น))?/g;
  for (const m of t.matchAll(re)) {
    const before = t.slice(Math.max(0, m.index - 12), m.index);
    const unit = (m[3] ?? "").trim();
    let role: Role;
    if (unit === "%" || unit === "เปอร์เซ็น") role = "percent";
    else if (unit === "วัน") role = /เครดิต\s*$/.test(before) ? "credit" : "days";
    else if (/^(?:ชิ้น|อัน|เส้น|ตัว|กล่อง|แพ็ค)$/.test(unit)) role = "count";
    else if (/^(?:ทาง|แบบ|ข้อ)$/.test(unit)) role = "ways";
    else role = /(?:รวม|ยอด|ทั้งหมด)\s*$/.test(before) ? "total" : "price";
    out.push({ value: Number(m[2]), role });
  }
  return out;
}

const fail = (where: string, n: number): Validation => ({ ok: false, reason: `number:${where}:${n}` });

/** ข้อเสนอแต่ละข้อ: ราคา = ราคาต่อชิ้นของข้อนั้น · ยอดหลัง "รวม" = ยอดรวม · ชิ้น = จำนวนหรือจำนวนของแถม · วัน = เครดิตเท่านั้น */
function checkOption(text: string, offer: Offer, names: string[]): Validation {
  for (const { value, role } of mentions(text, [...names, offer.bundle?.name ?? ""])) {
    const ok =
      role === "price"
        ? value === offer.pricePerUnit
        : role === "total"
          ? value === offer.total
          : role === "count"
            ? value === offer.qty || value === offer.bundle?.qty
            : role === "credit"
              ? offer.creditDays > 0 && value === offer.creditDays
              : false;
    if (!ok) return fail(offer.id, value);
  }
  return { ok: true };
}

/**
 * ประโยคเปิด: ทวนราคาที่ลูกค้าขอ (ต้องปฏิเสธ เว้นแต่มีข้อที่ได้ราคานั้นจริง) / ราคาร้านอื่น (ต้องปฏิเสธ) / ราคาขาย
 * จำนวนชิ้น = ที่ลูกค้าขอ · "N ทาง" = จำนวนข้อเสนอ
 */
function checkIntro(text: string, facts: ReplyFacts, names: string[]): Validation {
  const asked = facts.requestedPrice === null ? null : Math.ceil(facts.requestedPrice * 100) / 100;
  const meeting = asked === null ? [] : facts.offers.filter((o) => o.pricePerUnit <= asked);
  const meetsAsk = meeting.length > 0;
  if (MATCHES_COMPETITOR.test(text)) return { ok: false, reason: "competitor" };
  if (!meetsAsk && AGREES.test(text)) return { ok: false, reason: "claim" };
  const refuses = REFUSES.test(text);
  for (const { value, role } of mentions(text, names)) {
    const ok =
      role === "count"
        ? // จำนวนที่ลูกค้าขอ หรือจำนวนของข้อที่ได้ราคาที่ขอ ("ได้ถ้าสั่ง 1,500 ชิ้น")
          value === facts.qty || meeting.some((o) => o.qty === value)
        : role === "ways"
          ? value === facts.offers.length
          : role === "price" || role === "total"
            ? (value === asked && (refuses || meetsAsk)) ||
              (value === facts.competitorPrice && refuses) ||
              value === facts.product?.listPrice
            : false;
    if (!ok) return fail("intro", value);
  }
  return { ok: true };
}

/** คำถามปิด: ไม่มีตัวเลข (นอกจาก "N ทาง" = จำนวนข้อเสนอ) */
function checkClosing(text: string, facts: ReplyFacts, names: string[]): Validation {
  for (const { value, role } of mentions(text, names)) {
    if (!(role === "ways" && value === facts.offers.length)) return fail("closing", value);
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

  if (parts.some((p) => NUMBER_WORD.test(normalize(p)))) return { ok: false, reason: "number_word" };

  const names = [facts.product?.name ?? ""];
  const checks = [
    checkIntro(draft.intro, facts, names),
    ...draft.options.map((o) => checkOption(o.text, facts.offers.find((x) => x.id === o.id)!, names)),
    checkClosing(draft.closing, facts, names),
  ];
  return checks.find((c) => !c.ok) ?? { ok: true };
}
