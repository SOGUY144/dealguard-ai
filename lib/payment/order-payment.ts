// QR ชำระเงินของออเดอร์ (หน้า /order/[id]) — สร้างที่ server
import "server-only";
import QRCode from "qrcode";
import type { PaymentView } from "@/components/order/payment-card";
import type { OrderView } from "@/lib/chat/mock-orders";
import { promptPayPayload } from "./promptpay";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * ร้านตั้ง PROMPTPAY_ID (เบอร์/เลขบัตรของร้านเอง) → QR พร้อมเพย์จริงพร้อมยอด
 * ไม่ตั้ง → QR ตัวอย่างที่แอปธนาคารอ่านไม่ได้ (ทีมตั้งใจไม่ใส่บัญชีจริงในเดโม กันคนโอนผิด)
 */
export async function paymentFor(order: OrderView, promptPayId = process.env.PROMPTPAY_ID): Promise<PaymentView> {
  const real = promptPayId?.trim() ? promptPayPayload(promptPayId.trim(), order.offer.total) : null;
  const text = real ?? `DEALGUARD-DEMO|${order.id}|${order.offer.total.toFixed(2)}`;
  const qrSvg = await QRCode.toString(text, {
    type: "svg",
    margin: 1,
    errorCorrectionLevel: "M",
    color: { dark: "#1E1B2E", light: "#FFFFFF" },
  });
  const dueAt = order.offer.creditDays > 0 ? new Date(Date.parse(order.at) + order.offer.creditDays * DAY_MS).toISOString() : null;
  return { qrSvg, mode: real ? "promptpay" : "demo", dueAt, paidAt: order.paidAt };
}
