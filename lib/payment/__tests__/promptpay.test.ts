import { describe, expect, it } from "vitest";
import { promptPayPayload } from "../promptpay";

// ค่าอ้างอิงจากไลบรารี promptpay-qr@0.5.0 (ใช้กันแพร่หลาย) — ข้อความต้องตรงทุกตัวอักษร ไม่งั้นแอปธนาคารสแกนไม่ได้
describe("promptPayPayload", () => {
  it("เบอร์มือถือ + ยอดเงิน", () => {
    expect(promptPayPayload("0812345678", 125_000)).toBe(
      "00020101021229370016A000000677010111011300668123456785802TH53037645409125000.0063042B5F",
    );
    expect(promptPayPayload("081-234-5678", 4.22)).toBe(
      "00020101021229370016A000000677010111011300668123456785802TH530376454044.2263045D49",
    );
  });

  it("เลขบัตรประชาชน / เลขผู้เสียภาษี 13 หลัก", () => {
    expect(promptPayPayload("1234567890123", 110_000)).toBe(
      "00020101021229370016A000000677010111021312345678901235802TH53037645409110000.0063041DDA",
    );
  });

  it("ไม่ใส่ยอด = QR แบบใช้ซ้ำ", () => {
    expect(promptPayPayload("0812345678")).toBe(
      "00020101021129370016A000000677010111011300668123456785802TH530376463045D82",
    );
  });

  it("รูปแบบผิด / ยอดผิด → null", () => {
    expect(promptPayPayload("12345")).toBeNull();
    expect(promptPayPayload("0812345678", 0)).toBeNull();
    expect(promptPayPayload("0812345678", Number.NaN)).toBeNull();
  });
});
