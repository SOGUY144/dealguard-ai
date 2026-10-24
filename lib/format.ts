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

/** 300000 → "฿300,000", 12.5 → "฿12.50", 6250000 → "฿6.25 ล้าน", -500 → "−฿500" */
export function formatBaht(n: number): string {
  const sign = n < 0 ? "−" : "";
  const abs = Math.abs(n);
  if (abs >= 1_000_000) {
    const millions = Math.round((abs / 1_000_000) * 100) / 100;
    return `${sign}฿${millions} ล้าน`;
  }
  // ราคาต่อชิ้นมีสตางค์ได้ (ราคาพื้น 12.50) — แสดง 2 ตำแหน่ง ไม่ปัดเป็นบาทเต็มจนดูเหมือนคิดผิด
  const satang = Math.round(abs * 100) / 100;
  const fractional = !Number.isInteger(satang);
  return `${sign}฿${satang.toLocaleString("en-US", { minimumFractionDigits: fractional ? 2 : 0, maximumFractionDigits: 2 })}`;
}

/** ปัดเป็นสตางค์ (2 ตำแหน่ง) — กันเศษทศนิยมแบบ 135.5 × 3 = 406.49999 */
export function roundSatang(n: number): number {
  return Math.round(n * 100) / 100;
}

const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** เที่ยงคืนของ "วันนี้" ตามเวลาไทย (UTC+7 ไม่มีเวลาออมแสง) */
export function bangkokDayStart(now: Date): Date {
  const local = now.getTime() + BANGKOK_OFFSET_MS;
  return new Date(local - (local % DAY_MS) - BANGKOK_OFFSET_MS);
}

const THAI_DATE = new Intl.DateTimeFormat("th-TH", {
  timeZone: "Asia/Bangkok",
  day: "numeric",
  month: "short",
  year: "numeric",
});

/** "24 ต.ค. 2569" ตามเวลาไทย */
export function thaiDate(date: Date): string {
  return THAI_DATE.format(date);
}

/** หัวแชต: วันเดียวกับวันนี้ (เวลาไทย) → "วันนี้" · วันก่อน → วันที่จริง */
export function formatDayLabel(iso: string, now: Date): string {
  const at = new Date(iso);
  return bangkokDayStart(at).getTime() === bangkokDayStart(now).getTime() ? "วันนี้" : thaiDate(at);
}

