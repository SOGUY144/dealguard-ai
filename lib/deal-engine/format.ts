/** 1500 → "1,500" */
export function formatQty(n: number): string {
  return n.toLocaleString("en-US");
}

/** 300000 → "฿300,000", 6250000 → "฿6.25 ล้าน" */
export function formatBaht(n: number): string {
  if (n >= 1_000_000) {
    const millions = Math.round((n / 1_000_000) * 100) / 100;
    return `฿${millions} ล้าน`;
  }
  return `฿${Math.round(n).toLocaleString("en-US")}`;
}
