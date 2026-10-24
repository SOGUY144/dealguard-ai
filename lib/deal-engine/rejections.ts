// ลูกค้าปฏิเสธทางเลือกไหนไปแล้วบ้าง — อ่านจากข้อความลูกค้าในแชต (ไม่ต้องเก็บแยกในฐานข้อมูล)
// ใช้ตัดข้อเสนอที่ลูกค้าบอกว่าไม่เอา ไม่ให้ AI วนเสนอแบบเดิม · ไฟล์นี้ไม่มีต้นทุน ใช้ได้ทุกฝั่ง
import type { Offer } from "./types";

/** ทางเลือกที่ปฏิเสธได้ (ราคาปกติไม่ใช่ทางเลือกแลก) */
export type TradeLever = Exclude<Offer["lever"], "list">;

// คำปฏิเสธที่วางหน้าเรื่อง ("ไม่สะดวกจ่ายสด") — ต้องติดกับเรื่องเลย (คั่นได้แค่ ของ/การ/ให้)
// ไม่งั้น "ไม่เอาของแถม จ่ายสดได้" จะนับว่าปฏิเสธจ่ายสดด้วย · "ไม่มีปัญหา จ่ายสดเลย" ไม่นับ เพราะมีคำอื่นคั่น
const NEG_BEFORE = "ไม่(?:ต้องการ|ต้องมี|ต้อง|เอา|อยากได้|อยาก|สะดวก|ไหว|ได้|ใช้|มี|รับ|ชอบ|โอเค|สน)?(?:ให้|การ)?(?:ของ)?";
// คำปฏิเสธที่ตามหลังเรื่อง ("จ่ายสดไม่ไหว" / "ของแถมไม่ต้อง")
const NEG_AFTER = "(?:ก็)?ไม่(?:ค่อย)?(?:ต้อง|เอา|ไหว|สะดวก|ได้|ใช้|รับ|ชอบ|โอเค|สน|จำเป็น|อยาก|มี(?!ปัญหา))";

const near = (topic: string) => new RegExp(`${NEG_BEFORE}(?:${topic})|(?:${topic})${NEG_AFTER}`);

const VOLUME_TOPIC = "(?:ซื้อ|สั่ง|เอา)(?:เพิ่ม|เยอะ|มากกว่านี้|มากขึ้น|ถึง)|เพิ่มจำนวน|สต[็๊]?อกเยอะ";
const BUNDLE_TOPIC = "แถม";
const CASH_TOPIC = "จ่าย(?:เงิน)?สด|เงินสด|(?:จ่าย|โอน)(?:ทันที|ก่อน)|โอนเลย";

const RULES: [TradeLever[], RegExp][] = [
  [["volume"], near(VOLUME_TOPIC)],
  // "เอาแค่ 1000" / "1000 พอครับ" / "จำนวนเท่าเดิม" = ไม่ขยับจำนวน
  [["volume"], /เอาแค่(?:นี้|\d)|แค่\d+(?:ชิ้น|เส้น|อัน)?พอ|\d+(?:ชิ้น|เส้น|อัน)?พอ(?:แล้ว|ครับ|ค่ะ|คะ|นะ)?$|(?:จำนวน|เอา|สั่ง|ซื้อ)เท่าเดิม/],
  [["bundle"], near(BUNDLE_TOPIC)],
  [["cash"], near(CASH_TOPIC)],
  // ขอเครดิต / ขอ 30 วันเหมือนเดิม / ขอจ่ายทีหลัง = ไม่จ่ายสด
  [["cash"], /(?:ขอ|ต้องการ|ต้องใช้|ใช้|อยากได้)เครดิต|ขอ(?:เครดิต)?\d+วัน|(?:จ่าย|โอน)ทีหลัง/],
  [
    ["volume", "cash", "bundle"],
    /ไม่(?:เอา|ชอบ|โอเค|ได้|รับ|สน|ถูกใจ)(?:เลย)?(?:สัก|ซัก|ทุก|ทั้ง(?:หมด|สาม|3))(?:อย่าง|ทาง|ข้อ|แบบ)?/,
  ],
];

// "ไม่มีของแถมหรอ" / "ทำไมไม่แถม" = ลูกค้าอยากได้ ไม่ใช่ปฏิเสธ
const QUESTION_AFTER = /^(?:อะไร|เลย|ให้)?(?:หรอ|เหรอ|หรือ|ไหม|มั้ย|ป่ะ|ปะ|ล่ะ|อ่ะ\?|\?)/;

function rejects(rule: RegExp, text: string): boolean {
  for (const m of text.matchAll(new RegExp(rule.source, "g"))) {
    const before = text.slice(0, m.index);
    const after = text.slice(m.index + m[0].length);
    if (!before.endsWith("ทำไม") && !QUESTION_AFTER.test(after)) return true;
  }
  return false;
}

const LETTER_REJECT = /ไม่(?:เอา|รับ|เลือก|ชอบ|โอเค)(?:ข้อ)?([ABC])(?![A-Z])/gi;

/** "ไม่เอาข้อ A" → ["A"] (ตัวอักษรต้องเทียบกับการ์ดที่ลูกค้าเห็นตอนนั้น) */
export function rejectedLetters(raw: string): Offer["id"][] {
  const text = raw.replace(/\s+/g, "");
  return [...text.matchAll(LETTER_REJECT)].map((m) => m[1].toUpperCase() as Offer["id"]);
}

/**
 * ลูกค้าพิมพ์เลือกข้อ: "เอาข้อ B" / "ข้อ B ครับ" / "B" → "B" · "ไม่เอาข้อ B" ไม่ใช่การเลือก
 * ใช้ชี้ไปข้อนั้นในการ์ด (ลูกค้ายังต้องกดยืนยันเอง)
 */
export function pickedLetter(raw: string): Offer["id"] | null {
  const text = raw.replace(/\s+/g, "");
  if (rejectedLetters(text).length > 0) return null;
  const m =
    text.match(/(?:เอา|เลือก|ตกลง|โอเค|ok|รับ)?ข้อ([ABC])(?![A-Z])/i) ??
    text.match(/^(?:เอา|เลือก|ตกลง|โอเค|ok|รับ)?([ABC])(?:ครับ|ค่ะ|คะ|นะ|เลย|จ้า|ละกัน)*$/i);
  return m ? (m[1].toUpperCase() as Offer["id"]) : null;
}

/** รวมทางเลือกที่ลูกค้าปฏิเสธจากข้อความทั้งหมด (ช่องว่างไม่มีผล) */
export function rejectedLevers(texts: string[]): TradeLever[] {
  const found = new Set<TradeLever>();
  for (const raw of texts) {
    const text = raw.replace(/\s+/g, "");
    for (const [levers, rule] of RULES) if (rejects(rule, text)) for (const l of levers) found.add(l);
  }
  return (["volume", "cash", "bundle"] as const).filter((l) => found.has(l));
}
