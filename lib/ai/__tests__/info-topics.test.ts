import { describe, expect, it } from "vitest";
import { infoTopics } from "../info-topics";

describe("infoTopics — ลูกค้าถามเรื่องอะไร (SKILL §11.3)", () => {
  it.each([
    ["ส่งเมื่อไหร่ครับ", ["delivery"]],
    ["ส่งกี่วันถึง", ["delivery"]],
    ["ค่าส่งเท่าไหร่", ["delivery"]],
    ["ส่งต่างจังหวัดได้ไหม", ["delivery"]],
    ["สั่งวันนี้ได้ของเมื่อไหร่", ["delivery"]],
    ["มีของไหม", ["stock"]],
    ["สต๊อกพอไหม", ["stock"]],
    ["ของหมดหรือยัง", ["stock"]],
    ["มีพร้อมส่งไหม", ["stock"]],
    ["จ่ายยังไงครับ", ["payment"]],
    ["โอนเข้าบัญชีไหน", ["payment"]],
    ["เก็บเงินปลายทางได้ไหม", ["payment"]],
    ["ผ่อนได้ไหม", ["payment"]],
    ["มีของไหม ส่งกี่วัน", ["stock", "delivery"]],
  ] as const)("%s → %o", (text, topics) => {
    expect(infoTopics(text)).toEqual(topics);
  });

  it.each(["ขอ 125 ได้ไหม 1000 ชิ้น", "สวัสดีครับ", "สายยาวกี่เมตร", "ขอเหลือ 130", "หัวเสียบ Type-C ไหม"])(
    "%s → ไม่ใช่สามเรื่องนี้",
    (text) => {
      expect(infoTopics(text)).toEqual([]);
    },
  );
});
