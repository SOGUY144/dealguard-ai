// แปลงตัวเลขที่เขียนเป็นคำไทย ("หนึ่งพันห้าร้อย") เป็นเลขอารบิก — ตัวแปลงเสียงชอบเขียนแบบนี้
// แปลงเฉพาะกลุ่มคำที่มีหลัก (สิบ/ร้อย/พัน/...) ไม่แตะคำธรรมดาอย่าง "สามารถ", "เก้าอี้", "ห้าง"

const DIGITS: Record<string, number> = {
  หนึ่ง: 1,
  เอ็ด: 1,
  สอง: 2,
  ยี่: 2,
  สาม: 3,
  สี่: 4,
  ห้า: 5,
  หก: 6,
  เจ็ด: 7,
  แปด: 8,
  เก้า: 9,
};
const UNITS: Record<string, number> = { สิบ: 10, ร้อย: 100, พัน: 1000, หมื่น: 10_000, แสน: 100_000, ล้าน: 1_000_000 };

const TOKEN = new RegExp([...Object.keys(UNITS), ...Object.keys(DIGITS)].join("|"), "g");
const RUN = new RegExp(`(?:${[...Object.keys(UNITS), ...Object.keys(DIGITS)].join("|")})+`, "g");
/** หลักเดี่ยวๆ (เช่น "พัน") นับเป็นตัวเลขเฉพาะเมื่อตามด้วยหน่วยนับ — "พันธุ์" ไม่ใช่ 1,000 */
const COUNTER = /^\s*(?:ชิ้น|อัน|เส้น|ตัว|บาท|กล่อง|แพ็ค)/;

function parse(tokens: string[]): number {
  let total = 0;
  let section = 0;
  let current: number | null = null;
  let lastUnit = 0;
  let digitAfterUnit = false;
  for (const t of tokens) {
    if (t in DIGITS) {
      current = DIGITS[t];
      digitAfterUnit = lastUnit > 0;
      continue;
    }
    const unit = UNITS[t];
    if (unit === 1_000_000) {
      total = (total + section + (current ?? 0) || 1) * unit;
      section = 0;
    } else {
      section += (current ?? 1) * unit;
    }
    current = null;
    lastUnit = unit;
    digitAfterUnit = false;
  }
  if (current !== null) {
    // พูดย่อแบบไทย: "พันห้า" = 1,500 · "ร้อยห้า" = 150 (หลักที่ตามหลังหลักใหญ่ = หลักถัดลงมา)
    section += digitAfterUnit && lastUnit >= 100 ? current * (lastUnit / 10) : current;
  }
  return total + section;
}

export function thaiNumberWordsToDigits(text: string): string {
  let changed = false;
  const out = text.replace(RUN, (run, offset: number) => {
    const tokens = run.match(TOKEN) ?? [];
    const hasUnit = tokens.some((t) => t in UNITS);
    const lone = tokens.length === 1;
    if (!hasUnit || (lone && !COUNTER.test(text.slice(offset + run.length)))) return run;
    changed = true;
    return ` ${parse(tokens)} `;
  });
  return changed ? out.replace(/\s{2,}/g, " ").trim() : text;
}
