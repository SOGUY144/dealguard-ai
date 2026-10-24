import { describe, expect, it } from "vitest";
import { SHOP_ANSWER_MAX, cleanShopAnswers, validateShopAnswers } from "../shop-answers";

describe("คำตอบให้ลูกค้า (เถ้าแก่กรอกเอง)", () => {
  it("ตัดช่องว่างหัวท้าย · ปล่อยว่างได้ (= ผู้ช่วยยังไม่ตอบเรื่องนั้น)", () => {
    expect(cleanShopAnswers({ delivery: "  ส่งภายใน 2 วัน  ", stock: "   " })).toEqual({ delivery: "ส่งภายใน 2 วัน", stock: "" });
    expect(validateShopAnswers({ delivery: "", stock: "" })).toEqual({});
  });

  it("ยาวเกินที่ลูกค้าอ่านในแชตได้สบาย → ไม่ผ่าน บอกตรงช่อง", () => {
    const long = "ก".repeat(SHOP_ANSWER_MAX + 1);
    expect(validateShopAnswers({ delivery: long, stock: "มีของ" })).toEqual({ delivery: `ไม่เกิน ${SHOP_ANSWER_MAX} ตัวอักษร` });
  });

  it("ตัวอักษรควบคุม (วางมาจากที่อื่น) ถูกล้างออก แต่ขึ้นบรรทัดใหม่เป็นเว้นวรรค", () => {
    expect(cleanShopAnswers({ delivery: "ส่ง\u0007ภายใน\n2 วัน", stock: "" }).delivery).toBe("ส่งภายใน 2 วัน");
  });
});
