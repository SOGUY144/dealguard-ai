import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { paymentFor } = await import("../order-payment");

const order = {
  id: "11111111-2222-3333-4444-555555555555",
  productName: "สายชาร์จ Type-C 1 เมตร",
  at: "2026-10-25T03:00:00.000Z",
  confirmedAt: null as string | null,
  paidAt: null as string | null,
  offer: { id: "A" as const, lever: "list" as const, label: "ราคาที่เถ้าแก่อนุมัติ", pricePerUnit: 125, qty: 1000, conditionText: "", total: 125_000, creditDays: 7 },
};

describe("paymentFor", () => {
  it("ไม่ตั้ง PROMPTPAY_ID → QR ตัวอย่าง (สแกนจ่ายไม่ได้) + วันครบกำหนดตามเครดิต", async () => {
    const p = await paymentFor(order, undefined);
    expect(p.mode).toBe("demo");
    expect(p.qrSvg).toContain("<svg");
    expect(p.dueAt).toBe("2026-11-01T03:00:00.000Z");
  });

  it("ตั้งเบอร์พร้อมเพย์ของร้าน → QR พร้อมเพย์จริง · โอนทันที = ไม่มีวันครบกำหนด", async () => {
    const p = await paymentFor({ ...order, offer: { ...order.offer, creditDays: 0 } }, "0812345678");
    expect(p.mode).toBe("promptpay");
    expect(p.dueAt).toBeNull();
  });

  it("ร้านยืนยันรับเงินแล้ว → ส่งเวลาที่ยืนยันไปให้ใบสรุป", async () => {
    const p = await paymentFor({ ...order, paidAt: "2026-10-26T04:30:00.000Z" }, "0812345678");
    expect(p.paidAt).toBe("2026-10-26T04:30:00.000Z");
  });

  it("ร้านยืนยันออเดอร์แล้ว → ส่งเวลายืนยันไปให้ใบสรุป (ยังไม่ยืนยัน = null)", async () => {
    expect((await paymentFor(order, "0812345678")).confirmedAt).toBeNull();
    const p = await paymentFor({ ...order, confirmedAt: "2026-10-25T03:20:00.000Z" }, "0812345678");
    expect(p.confirmedAt).toBe("2026-10-25T03:20:00.000Z");
  });

  it("เลขพร้อมเพย์ผิดรูปแบบ → กลับไปใช้ QR ตัวอย่าง", async () => {
    expect((await paymentFor(order, "abc")).mode).toBe("demo");
  });
});
