// สร้างข้อความ QR พร้อมเพย์ (มาตรฐาน EMVCo ของ ธปท.) — ไม่มี dependency · ใช้ได้ทั้ง server และ browser
// ร้านต้องตั้ง PROMPTPAY_ID เป็นบัญชีของตัวเองเท่านั้น ถ้าไม่ตั้ง หน้าออเดอร์ใช้ QR ตัวอย่างที่สแกนจ่ายไม่ได้

const AID_MERCHANT_PRESENTED = "A000000677010111";

const field = (id: string, value: string) => `${id}${String(value.length).padStart(2, "0")}${value}`;

/** CRC16-CCITT (poly 0x1021, เริ่ม 0xFFFF) ตามที่ QR พร้อมเพย์ใช้ */
export function crc16(text: string): string {
  let crc = 0xffff;
  for (let i = 0; i < text.length; i++) {
    crc ^= text.charCodeAt(i) << 8;
    for (let b = 0; b < 8; b++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

/** เบอร์มือถือ 10 หลัก → sub-tag 01 · เลขบัตร/เลขผู้เสียภาษี 13 หลัก → 02 · e-Wallet 15 หลัก → 03 · อื่นๆ = null */
function account(id: string): string | null {
  const digits = id.replace(/\D/g, "");
  if (/^0\d{9}$/.test(digits)) return field("01", `0066${digits.slice(1)}`.padStart(13, "0"));
  if (/^\d{13}$/.test(digits)) return field("02", digits);
  if (/^\d{15}$/.test(digits)) return field("03", digits);
  return null;
}

/** ข้อความสำหรับทำ QR พร้อมเพย์พร้อมยอดเงิน — id ผิดรูปแบบ / ยอดไม่ถูกต้อง → null */
export function promptPayPayload(id: string, amount?: number): string | null {
  const acct = account(id);
  if (!acct) return null;
  if (amount !== undefined && !(Number.isFinite(amount) && amount > 0)) return null;
  const body = [
    field("00", "01"),
    field("01", amount !== undefined ? "12" : "11"),
    field("29", field("00", AID_MERCHANT_PRESENTED) + acct),
    field("58", "TH"),
    field("53", "764"),
    amount !== undefined ? field("54", amount.toFixed(2)) : "",
  ].join("");
  const withCrcTag = `${body}6304`;
  return withCrcTag + crc16(withCrcTag);
}
