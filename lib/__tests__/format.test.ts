import { describe, expect, it } from "vitest";
import { formatBaht, formatClock, formatCredit, formatDayLabel, formatDuration, formatQty } from "../format";

describe("format", () => {
  it("จำนวนมีคอมมา", () => {
    expect(formatQty(1500)).toBe("1,500");
  });

  it("เงินบาท และหลักล้าน", () => {
    expect(formatBaht(195_000)).toBe("฿195,000");
    expect(formatBaht(6_250_000)).toBe("฿6.25 ล้าน");
  });

  it("ราคามีสตางค์แสดง 2 ตำแหน่ง · ติดลบใช้ −฿", () => {
    expect(formatBaht(12.5)).toBe("฿12.50");
    expect(formatBaht(136.5)).toBe("฿136.50");
    expect(formatBaht(1234.567)).toBe("฿1,234.57");
    expect(formatBaht(-500)).toBe("−฿500");
    expect(formatBaht(-1_500_000)).toBe("−฿1.5 ล้าน");
  });

  it("เวลาเป็นเวลาไทย 24 ชม. ไม่ว่าเครื่องจะอยู่ timezone ไหน", () => {
    expect(formatClock("2026-10-23T14:30:00Z")).toBe("21:30");
    expect(formatClock("2026-10-23T00:05:00Z")).toBe("07:05");
  });

  it("เงื่อนไขการชำระเงิน", () => {
    expect(formatCredit(0)).toBe("โอนทันที");
    expect(formatCredit(30)).toBe("เครดิต 30 วัน");
  });

  it("ความยาวเสียงเป็น นาที:วินาที", () => {
    expect(formatDuration(14)).toBe("0:14");
    expect(formatDuration(75.4)).toBe("1:15");
  });
});

describe("formatDayLabel (หัวแชต — แชตเดียวใช้ยาวหลายวัน)", () => {
  const now = new Date("2026-10-24T10:00:00Z"); // 17:00 เวลาไทย 24 ต.ค.
  it("วันเดียวกันตามเวลาไทย → วันนี้", () => {
    expect(formatDayLabel("2026-10-23T18:00:00Z", now)).toBe("วันนี้"); // 01:00 ไทย 24 ต.ค.
  });
  it("วันก่อน → วันที่จริง", () => {
    expect(formatDayLabel("2026-10-23T16:00:00Z", now)).toBe("23 ต.ค. 2569"); // 23:00 ไทย 23 ต.ค.
  });
});

