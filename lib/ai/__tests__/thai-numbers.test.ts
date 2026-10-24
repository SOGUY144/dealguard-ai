import { describe, expect, it } from "vitest";
import { thaiNumberWordsToDigits } from "../thai-numbers";

// ตัวแปลงเสียงเขียนตัวเลขเป็นคำ ("หนึ่งพันห้าร้อย") บ่อย — แปลงเป็นเลขก่อนเข้าแชต/ตัวแยกข้อความ
describe("thaiNumberWordsToDigits", () => {
  it.each([
    ["สั่งหนึ่งพันห้าร้อยชิ้นครับ", "สั่ง 1500 ชิ้นครับ"],
    ["ขอหนึ่งร้อยยี่สิบห้าได้ไหม", "ขอ 125 ได้ไหม"],
    ["ขอร้อยยี่สิบห้า หนึ่งพันชิ้น", "ขอ 125 1000 ชิ้น"],
    ["ห้าหมื่นชิ้น", "50000 ชิ้น"],
    ["สิบเอ็ดชิ้น", "11 ชิ้น"],
    ["ยี่สิบชิ้น", "20 ชิ้น"],
    ["สองพันห้าร้อยห้าสิบ", "2550"],
    ["หนึ่งล้านสองแสน", "1200000"],
  ])('"%s" → "%s"', (input, expected) => {
    expect(thaiNumberWordsToDigits(input)).toBe(expected);
  });

  it("พูดย่อแบบไทย: พันห้า = 1,500 · ร้อยห้า = 150", () => {
    expect(thaiNumberWordsToDigits("เอาพันห้าชิ้น")).toBe("เอา 1500 ชิ้น");
    expect(thaiNumberWordsToDigits("ขอร้อยห้าได้ไหม")).toBe("ขอ 150 ได้ไหม");
  });

  it("ไม่แตะคำธรรมดาที่บังเอิญมีตัวเลข", () => {
    for (const text of ["สวัสดีครับ", "หนึ่งในสินค้าที่ดี", "เก้าอี้", "สามารถส่งได้ไหม", "ร้านข้างๆ ให้ 110", "ห้าง"]) {
      expect(thaiNumberWordsToDigits(text)).toBe(text);
    }
  });

  it("ตัวเลขตามด้วยหลักภาษาไทย (2 พัน, 1.5 พัน, 5 ร้อย) = คูณกัน", () => {
    expect(thaiNumberWordsToDigits("เอา 2 พันชิ้น")).toBe("เอา 2000 ชิ้น");
    expect(thaiNumberWordsToDigits("1.5 พันชิ้น")).toBe("1500 ชิ้น");
    expect(thaiNumberWordsToDigits("5 ร้อยชิ้น")).toBe("500 ชิ้น");
    expect(thaiNumberWordsToDigits("2หมื่นชิ้น")).toBe("20000 ชิ้น");
    expect(thaiNumberWordsToDigits("ขอ 1 พันชิ้น ราคา 130")).toBe("ขอ 1000 ชิ้น ราคา 130");
  });
});

