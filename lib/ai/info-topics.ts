// โหมดถามข้อมูลทั่วไป (SKILL §11.3): ลูกค้าถามเรื่องส่งของ / สต๊อก / การจ่ายเงิน
// แยกด้วยกฎตายตัว ไม่ใช้ GPT — คำตอบมาจากที่เถ้าแก่กรอกเท่านั้น ไม่ต้องให้ AI เดาว่าถามอะไร

export type InfoTopic = "stock" | "delivery" | "payment";

const TOPICS: [InfoTopic, RegExp][] = [
  // "เหลือกี่" ได้ แต่ "ขอเหลือ 130" คือขอราคา
  ["stock", /มีของ|ของมี|สต๊อก|สต็อก|stock|ของหมด|หมดไหม|หมดหรือยัง|พร้อมส่ง|เหลือกี่|มีพอ|ของพอ/i],
  ["delivery", /ส่ง(?:ของ)?(?:เมื่อไหร่|เมื่อไร|กี่วัน|ได้ไหม|ได้มั้ย|ยังไง|ทางไหน|ต่างจังหวัด|ถึง)|จัดส่ง|ค่าส่ง|ขนส่ง|ได้ของ(?:เมื่อไหร่|เมื่อไร|กี่วัน)|รับของ(?:เอง|ที่ร้าน)/],
  ["payment", /จ่าย(?:เงิน)?(?:ยังไง|ทางไหน|แบบไหน|ช่องทาง)|ชำระ|โอน(?:เข้า)?(?:บัญชี|ทางไหน)|เลขบัญชี|เก็บเงินปลายทาง|ผ่อน|บัตรเครดิต|พร้อมเพย์|qr/i],
];

/** เรื่องที่ถาม เรียงตามลำดับในรายการ (ไม่ซ้ำ) · ว่าง = ไม่ใช่สามเรื่องนี้ */
export function infoTopics(text: string): InfoTopic[] {
  const found = TOPICS.filter(([, pattern]) => pattern.test(text)).map(([topic]) => topic);
  // ตอบตามลำดับที่ลูกค้าถาม
  return found.sort((a, b) => firstIndex(text, a) - firstIndex(text, b));
}

function firstIndex(text: string, topic: InfoTopic): number {
  const pattern = TOPICS.find(([t]) => t === topic)![1];
  return text.search(pattern);
}
