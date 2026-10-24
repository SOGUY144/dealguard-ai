import { describe, expect, it } from "vitest";
import { MOCK_OFFERS } from "@/lib/chat/mock-offers";
import { assembleReply, validateChatText, validateDraft, type ChatTextFacts, type ReplyDraft, type ReplyFacts } from "../validator";

// ข้อเสนอตัวอย่าง SKILL: A 1,500 × ฿130 = ฿195,000 เครดิต 30 วัน · B ฿135 จ่ายสด · C ฿145 + หัวชาร์จ 20W 200 ชิ้น
const facts: ReplyFacts = {
  buyerName: "คุณนก",
  ownerName: "เฮียชัย",
  product: { sku: "CBL-C-1M", name: "สายชาร์จ Type-C 1 เมตร", listPrice: 150 },
  requestedPrice: 125,
  qty: 1000,
  competitorPrice: 110,
  offers: MOCK_OFFERS,
};

const GOOD: ReplyDraft = {
  intro: "คุณนกครับ ราคา 125 ที่ 1,000 ชิ้นเฮียชัยให้ไม่ไหว แต่มี 3 ทางครับ",
  options: [
    { id: "A", text: "ซื้อ 1,500 ชิ้น ได้ ฿130 เครดิต 30 วัน" },
    { id: "B", text: "จ่ายสดได้ ฿135" },
    { id: "C", text: "฿145 แถมหัวชาร์จ 20W 200 ชิ้น" },
  ],
  closing: "สนใจทางไหนครับ",
};
const check = (patch: Partial<ReplyDraft>) => validateDraft({ ...GOOD, ...patch }, facts);
const option = (id: "A" | "B" | "C", text: string) => ({ options: GOOD.options.map((o) => (o.id === id ? { id, text } : o)) });

describe("assembleReply", () => {
  it("ต่อเป็นข้อความเดียว ใส่ตัวอักษรข้อให้เอง", () => {
    expect(assembleReply(GOOD)).toBe(
      "คุณนกครับ ราคา 125 ที่ 1,000 ชิ้นเฮียชัยให้ไม่ไหว แต่มี 3 ทางครับ ข้อ A ซื้อ 1,500 ชิ้น ได้ ฿130 เครดิต 30 วัน · ข้อ B จ่ายสดได้ ฿135 · ข้อ C ฿145 แถมหัวชาร์จ 20W 200 ชิ้น สนใจทางไหนครับ",
    );
  });
});

describe("validateDraft — ตัวเลขต้องตรงกับข้อเสนอข้อนั้น", () => {
  it("ตัวเลขถูกที่ → ผ่าน", () => {
    expect(validateDraft(GOOD, facts)).toEqual({ ok: true });
  });

  it("ยอดรวม / ชื่อสินค้า / ราคาร้านอื่น / ราคาปกติ / เลขไทย → ผ่าน", () => {
    expect(
      check({
        intro: "คุณนกครับ สายชาร์จ Type-C 1 เมตร ปกติ ๑๕๐ ร้านอื่นให้ 110 เฮียชัยลดตามไม่ได้ครับ",
        ...option("A", "1,500 ชิ้น รวม ฿195,000"),
      }),
    ).toEqual({ ok: true });
  });

  it("เอาราคาที่ลูกค้าขอไปใส่เป็นราคาข้อเสนอ → ไม่ผ่าน", () => {
    expect(check(option("B", "จ่ายสดได้ ฿125"))).toEqual({ ok: false, reason: "number:B:125" });
  });

  it("เอาราคาข้อหนึ่งไปใส่อีกข้อ → ไม่ผ่าน", () => {
    expect(check(option("C", "฿135 แถมหัวชาร์จ 20W"))).toEqual({ ok: false, reason: "number:C:135" });
  });

  it("ประโยคเปิดพูดราคาข้อเสนอ → ไม่ผ่าน (ราคาต้องอยู่ในข้อของมัน)", () => {
    expect(check({ intro: "คุณนกครับ ได้ต่ำสุด ฿130 ครับ" })).toEqual({ ok: false, reason: "number:intro:130" });
  });

  it.each([
    ["ราคาที่แต่งเอง", option("B", "จ่ายสดได้ ฿128")],
    ["ยอดรวมที่แต่งเอง", option("A", "รวม ฿190,000")],
    ["จำนวนที่แต่งเอง", option("A", "ซื้อ 2,000 ชิ้น ฿130")],
    ["เปอร์เซ็นต์ที่แต่งเอง", option("B", "จ่ายสดลด 10%")],
    ["ตัวเลขเขียนเป็นคำ (แปลงแล้วไม่ตรง)", option("B", "ร้อยยี่สิบแปดบาท")],
    ["ตัวเลขคำเดี่ยวที่แปลงไม่ได้", option("B", "ลดให้อีกห้าบาท")],
    ["ตัวเลขในประโยคปิด", { closing: "ตัดสินใจภายใน 2 วันนะครับ" }],
  ])("%s → ไม่ผ่าน", (_label, patch) => {
    expect(check(patch).ok).toBe(false);
  });
});

describe("validateDraft — คำสัญญาต้องห้าม / ข้อมูลหลังบ้าน", () => {
  it.each(["ส่งฟรีด้วย", "ฟรีค่าส่ง", "รับประกัน 30 วัน", "ไม่พอใจคืนเงินได้", "ราคาต้นทุน", "ต่ำกว่าราคาพื้นไม่ได้", "กำไรน้อย"])(
    '"%s" → ไม่ผ่าน',
    (text) => {
      expect(check(option("A", text))).toEqual({ ok: false, reason: "forbidden" });
    },
  );
});

describe("validateDraft — ห้ามพูดเรื่องที่ไม่เกิดขึ้น (วัดจาก GPT จริง 24 ต.ค. 2569)", () => {
  const noCompetitor = { ...facts, competitorPrice: null };
  const noRequest = { ...facts, requestedPrice: null };

  it("ลูกค้าไม่ได้อ้างร้านอื่น แต่พูดถึงร้านอื่น → ไม่ผ่าน", () => {
    for (const intro of ["คุณนกครับ ลดตามร้านอื่นไม่ได้ครับ", "คุณนกครับ ที่อื่นก็ราคานี้ครับ", "คุณนกครับ ลดตามแพลตฟอร์มอื่นไม่ได้ครับ"]) {
      expect(validateDraft({ ...GOOD, intro }, noCompetitor), intro).toEqual({ ok: false, reason: "competitor" });
    }
  });

  it("ลูกค้าอ้างร้านอื่นจริง → พูดถึงได้", () => {
    expect(check({ intro: "คุณนกครับ ร้านอื่นให้ 110 เฮียชัยลดตามไม่ได้ครับ" })).toEqual({ ok: true });
  });

  it("ลูกค้าไม่ได้ขอราคา แต่บอกว่าราคาที่ขอให้ไม่ได้ → ไม่ผ่าน", () => {
    for (const intro of ["คุณนกครับ ราคาที่ขอให้ไม่ไหวครับ", "คุณนกครับ ราคาที่ต้องการให้ไม่ได้ครับ", "คุณนกครับ ราคาที่เสนอมาให้ไม่ไหวครับ"]) {
      expect(validateDraft({ ...GOOD, intro }, noRequest), intro).toEqual({ ok: false, reason: "request" });
    }
  });

  it("อ้างว่าทำอะไรไปแล้ว (แจ้ง/ส่งเรื่อง/ปรึกษา) → ไม่ผ่าน", () => {
    for (const intro of ["คุณนกครับ ผมแจ้งเฮียชัยแล้วครับ", "คุณนกครับ ส่งเรื่องให้แล้วครับ", "คุณนกครับ ขอปรึกษาเฮียชัยก่อนครับ"]) {
      expect(check({ intro }), intro).toEqual({ ok: false, reason: "claim" });
    }
  });
});

describe("validateDraft — รูปแบบ", () => {
  it("ต้องมีครบทุกข้อ ตามลำดับ ข้อละครั้ง", () => {
    expect(check({ options: GOOD.options.slice(0, 2) })).toEqual({ ok: false, reason: "options" });
    expect(check({ options: [GOOD.options[1], GOOD.options[0], GOOD.options[2]] })).toEqual({ ok: false, reason: "options" });
  });

  it("อ้างตัวอักษรข้อเองในข้อความ → ไม่ผ่าน (ระบบใส่ให้)", () => {
    expect(check(option("A", "ดีกว่าข้อ D"))).toEqual({ ok: false, reason: "offer_letter" });
  });

  it("ประโยคเปิดไม่เรียกชื่อลูกค้า → ไม่ผ่าน", () => {
    expect(check({ intro: "ราคานี้ให้ไม่ไหวครับ" })).toEqual({ ok: false, reason: "no_name" });
  });

  it("ไม่มีครับ / ใช้ค่ะ → ไม่ผ่าน (เสียง AI ผู้ชาย)", () => {
    expect(check({ intro: "คุณนก ให้ไม่ไหว", closing: "สนใจทางไหน" })).toEqual({ ok: false, reason: "tone" });
    expect(check({ closing: "สนใจทางไหนคะ ค่ะ" })).toEqual({ ok: false, reason: "tone" });
  });

  it("ยาวเกิน → ไม่ผ่าน", () => {
    expect(check({ closing: `สนใจทางไหนครับ ${"ยาวมาก".repeat(50)}` })).toEqual({ ok: false, reason: "too_long" });
  });

  it("ส่วนใดว่าง → ไม่ผ่าน", () => {
    expect(check({ intro: "  " })).toEqual({ ok: false, reason: "empty" });
    expect(check(option("B", ""))).toEqual({ ok: false, reason: "empty" });
  });
});

describe("รีวิวรอบ 3 — ตัวเลขต้องอยู่ถูกบทบาท (ราคา/จำนวน/วันเครดิต)", () => {
  it.each([
    ["ราคาเป็นจำนวนวันเครดิต", option("A", "ซื้อ 1,500 ชิ้น ได้ ฿30")],
    ["ราคาเป็นเลขในชื่อสินค้า", option("A", "ซื้อ 1,500 ชิ้น ได้ชิ้นละ ฿1")],
    ["สลับราคากับจำนวน", option("A", "ซื้อ 130 ชิ้น ได้ ฿1,500")],
    ["ราคาเป็นจำนวนชิ้น", option("B", "จ่ายสดได้ ฿1,000")],
    ["ราคาเป็นเลขในชื่อของแถม", option("C", "฿20 แถมหัวชาร์จ 20W 200 ชิ้น")],
    ["ส่งภายในกี่วัน (สัญญาที่ไม่มีในข้อเสนอ)", option("A", "ซื้อ 1,500 ชิ้น ฿130 ส่งภายใน 1 วัน")],
    ["วันที่ไม่ใช่เครดิต", { closing: "ตัดสินใจใน 3 วันนะครับ" }],
  ])("%s → ไม่ผ่าน", (_label, patch) => {
    expect(check(patch).ok).toBe(false);
  });

  it("ราคาต่อชิ้น / ยอดรวมหลัง 'รวม' / เครดิต N วัน ของข้อนั้น → ผ่าน", () => {
    expect(check(option("A", "ซื้อ 1,500 ชิ้น ชิ้นละ 130 บาท รวม ฿195,000 เครดิต 30 วัน"))).toEqual({ ok: true });
  });
});

describe("รีวิวรอบ 3 — ประโยคเปิดห้ามตอบตกลงราคาที่ลูกค้าขอ / ราคาร้านอื่น", () => {
  it.each([
    "คุณนกครับ ได้ครับ ฿125 ที่ 1,000 ชิ้น",
    "คุณนกครับ เฮียชัยให้ ฿110 เท่าร้านอื่นได้เลยครับ",
    "คุณนกครับ ยินดีขาย 125 ครับ",
  ])('"%s" → ไม่ผ่าน', (intro) => {
    expect(check({ intro }).ok).toBe(false);
  });

  it("ขอต่ำกว่าพื้นแล้วบอกว่ายินดีขาย → ไม่ผ่าน", () => {
    expect(validateDraft({ ...GOOD, intro: "คุณนกครับ ยินดีขาย ฿100 ครับ" }, { ...facts, requestedPrice: 100 }).ok).toBe(false);
  });

  it("มีข้อที่ได้ราคาเท่าที่ขอ → บอกจำนวนของข้อนั้นในประโยคเปิดได้ (วัดจาก GPT จริง)", () => {
    expect(
      validateDraft({ ...GOOD, intro: "คุณนกครับ ราคา 135 ได้ถ้าสั่ง 1,500 ชิ้น หรือจ่ายสด มี 3 ทางให้เลือกครับ" }, { ...facts, requestedPrice: 135 }),
    ).toEqual({ ok: true });
    expect(validateDraft({ ...GOOD, intro: "คุณนกครับ ราคา 125 ได้ถ้าสั่ง 1,500 ชิ้นครับ" }, facts).ok).toBe(false);
  });

  it("มีข้อที่ได้ราคาเท่าที่ขอ → บอกว่าได้ถ้าเลือกทางนั้นได้", () => {
    expect(validateDraft({ ...GOOD, intro: "คุณนกครับ ราคา 135 ได้ครับถ้าจ่ายสด มี 3 ทางครับ" }, { ...facts, requestedPrice: 135 })).toEqual({
      ok: true,
    });
  });
});

describe("รีวิวรอบ 3 — คำสัญญาที่ยังหลุด", () => {
  it.each([
    "ซื้อ 1,500 ชิ้น ฿130 มีประกัน",
    "ซื้อ 1,500 ชิ้น ฿130 การันตีของแท้",
    "ซื้อ 1,500 ชิ้น ฿130 ส่งให้ฟรี",
    "ซื้อ 1,500 ชิ้น ฿130 ฟรีค่าขนส่ง",
    "ซื้อ 1,500 ชิ้น ฿130 ไม่มีค่าส่ง",
    "ซื้อ 1,500 ชิ้น ฿130 free shipping",
    "ซื้อ 1,500 ชิ้น ฿130 เปลี่ยนสินค้าได้",
    "ซื้อ 1,500 ชิ้น ฿130 ขายเท่าทุนแล้ว",
    "ครึ่งราคา ฿130",
    "ซื้อ 1,500 ชิ้น ฿130 ลดอีกห้า",
  ])('"%s" → ไม่ผ่าน', (text) => {
    expect(check(option("A", text)).ok).toBe(false);
  });
});

// คุยอิสระ (25 ต.ค. 2569): GPT ตอบตรงคำถามเอง — พูดตัวเลขได้แค่ราคาปกติ + ขนาดในชื่อสินค้า
// และห้ามพูดเรื่องสเปก/ส่วนลด/การส่ง/สต๊อกเลย (ไม่มีข้อมูลในทางนี้ และแยกคำยืนยัน/ปฏิเสธภาษาไทยด้วย regex ไม่ได้แน่นอน)
describe("validateChatText — คุยอิสระ (strict)", () => {
  const free: ChatTextFacts = { numbers: [150], letters: [], names: ["สายชาร์จ Type-C 1 เมตร"], strict: true };
  const ok = (text: string, facts: ChatTextFacts = free) => validateChatText(text, facts);

  it.each([
    "สวัสดีครับ ผมเป็นผู้ช่วย AI ของเฮียชัยครับ",
    "สายยาว 1 เมตรครับ ราคาปกติ ฿150 ต่อชิ้นครับ",
    "สายยาว 1 ม. ครับ",
    "ยาว 1m ครับ",
    "ราคามาตรฐาน ฿150 ครับ",
    'ที่ตั้งร้านผมยังไม่มีข้อมูลครับ กด "คุยกับคนจริง" ที่หัวแชตได้เลยครับ',
  ])('"%s" → ผ่าน', (text) => {
    expect(ok(text)).toEqual({ ok: true });
  });

  it.each([
    ["สายยาว 2 เมตรครับ", "number:chat:2"],
    ["฿1 m ครับ", "number:chat:1"],
    ["500 ชิ้นขึ้นไป ฿125 ครับ", "number:chat:500"],
    ["ราคาส่ง ฿140 ครับ", "number:chat:140"],
    ["ของแท้ครับ ราคา ฿150 ครับ", "claim"],
    ["สินค้าเราแท้ครับ", "claim"],
    ["ชาร์จเร็วครับ", "claim"],
    ["เรื่องชาร์จเร็วผมยังไม่มีข้อมูลครับ", "claim"],
    ["ใช้ได้ทุกรุ่นครับ", "claim"],
    ["iPhone ใช้ได้ครับ", "claim"],
    ["รองรับ iPhone ครับ", "claim"],
    ["ทนมากครับ", "claim"],
    ["เดี๋ยวลดให้ครับ", "claim"],
    ["ให้ราคาพิเศษครับ", "claim"],
    ["พรุ่งนี้ส่งเลยครับ", "claim"],
    ["มีของพร้อมส่งเยอะครับ", "claim"],
    ["฿150 ต่อโหลครับ", "claim"],
    ["โหลละ ฿150 ครับ", "claim"],
    ["฿150 ต่อคู่ครับ", "claim"],
    ["เดี๋ยวลดราคาให้ครับ", "claim"],
    ["ถูกกว่านี้ได้ครับ", "claim"],
    ["ตกลงครับ ราคานั้นได้เลยครับ", "claim"],
    ["ได้ครับ จัดให้ครับ", "claim"],
    ["แถมหัวชาร์จให้ด้วยครับ", "claim"],
    ["ได้ของพรุ่งนี้ครับ", "claim"],
    ["เก็บเงินปลายทางได้ครับ", "claim"],
    ["ให้เครดิตได้ครับ", "claim"],
    ["เปลี่ยนได้ครับ", "claim"],
    ["ของเยอะครับ ไม่หมดแน่นอน", "claim"],
  ])('"%s" → ไม่ผ่าน (%s)', (text, reason) => {
    expect(ok(text)).toEqual({ ok: false, reason });
  });

  it("คำต้องห้ามที่อยู่ในชื่อสินค้าเอง ไม่นับ (ตัดชื่อออกก่อนตรวจ)", () => {
    expect(ok("หัวชาร์จเร็ว 20W ราคา ฿50 ครับ", { numbers: [50], letters: [], names: ["หัวชาร์จเร็ว 20W"], strict: true })).toEqual({ ok: true });
  });

  it("ราคาปกติของสินค้าที่คุยอยู่ ห้ามไปพูดคู่กับชื่อสินค้าอื่น", () => {
    const multi: ChatTextFacts = { ...free, names: [...free.names, "พาวเวอร์แบงก์ 10000mAh"], foreignNames: ["พาวเวอร์แบงก์", "10000mAh"] };
    expect(ok("พาวเวอร์แบงก์ 10000mAh ราคา ฿150 ครับ", multi)).toEqual({ ok: false, reason: "number:foreign:150" });
    expect(ok("พาวเวอร์แบงก์ ราคา ฿150 ครับ", multi)).toEqual({ ok: false, reason: "number:foreign:150" });
    expect(ok("ตัว 10000mAh ราคา ฿150 ครับ", multi)).toEqual({ ok: false, reason: "number:foreign:150" });
    expect(ok("มีพาวเวอร์แบงก์ 10000mAh ด้วยครับ ดูราคาได้จากปุ่มเลือกสินค้าครับ", multi)).toEqual({ ok: true });
  });

  it("ข้อความแบบอื่น (ไม่ strict) ไม่เปลี่ยนจากเดิม", () => {
    expect(ok("ของแท้ครับ ราคา ฿150 ครับ", { ...free, strict: undefined })).toEqual({ ok: true });
  });
});
