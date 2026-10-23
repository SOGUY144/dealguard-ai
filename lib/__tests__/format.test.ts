import { describe, expect, it } from "vitest";
import { formatBaht, formatClock, formatCredit, formatDuration, formatQty } from "../format";

describe("format", () => {
  it("จำนวนมีคอมมา", () => {
    expect(formatQty(1500)).toBe("1,500");
  });

  it("เงินบาท และหลักล้าน", () => {
    expect(formatBaht(195_000)).toBe("฿195,000");
    expect(formatBaht(6_250_000)).toBe("฿6.25 ล้าน");
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
