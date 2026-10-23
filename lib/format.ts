/** 1500 → "1,500" */
export function formatQty(n: number): string {
  return n.toLocaleString("en-US");
}

const clock = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Bangkok",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** ISO → "21:30" ตามเวลาไทยเสมอ (server กับ browser ได้ค่าเดียวกัน ไม่ hydration mismatch) */
export function formatClock(iso: string): string {
  return clock.format(new Date(iso));
}

/** 0 → "โอนทันที", 30 → "เครดิต 30 วัน" */
export function formatCredit(days: number): string {
  return days === 0 ? "โอนทันที" : `เครดิต ${days} วัน`;
}

/** 14 → "0:14" */
export function formatDuration(seconds: number): string {
  const total = Math.round(seconds);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

/** 300000 → "฿300,000", 6250000 → "฿6.25 ล้าน" */
export function formatBaht(n: number): string {
  if (n >= 1_000_000) {
    const millions = Math.round((n / 1_000_000) * 100) / 100;
    return `฿${millions} ล้าน`;
  }
  return `฿${Math.round(n).toLocaleString("en-US")}`;
}
