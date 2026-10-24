import { Check, QrCode } from "lucide-react";
import { formatBaht, formatClock, thaiDate } from "@/lib/format";

/**
 * QR + วันครบกำหนด + สถานะการชำระของออเดอร์ (สร้างที่ server)
 * promptpay = ร้านตั้ง PROMPTPAY_ID ของตัวเองแล้ว · demo = QR ตัวอย่าง สแกนจ่ายจริงไม่ได้
 * paidAt = เถ้าแก่กด "ได้รับเงินแล้ว" (null = รอร้านยืนยัน)
 */
export type PaymentView = { qrSvg: string; mode: "promptpay" | "demo"; dueAt: string | null; paidAt: string | null };

/** ส่วนชำระเงินท้ายใบสรุปออเดอร์ — สถานะมาจากฐานข้อมูลเท่านั้น (ลูกค้ากดเปลี่ยนเองไม่ได้) */
export function PaymentCard({ payment, total }: { payment: PaymentView; total: number }) {
  const due = payment.dueAt ? `ชำระภายใน ${thaiDate(new Date(payment.dueAt))}` : "ชำระทันที";

  return (
    <section
      aria-label="ชำระเงิน"
      className="flex flex-col items-center gap-2.5 rounded-[24px] border border-white/95 bg-white/78 px-[18px] py-4 text-center shadow-[0_14px_34px_rgba(110,90,170,0.10)]"
    >
      {payment.paidAt ? (
        <>
          <span role="status" className="flex items-center gap-1.5 rounded-full bg-ok-bg px-3.5 py-2 text-sm font-semibold text-ok-ink">
            <Check aria-hidden="true" size={16} />
            ชำระแล้ว {formatBaht(total)}
          </span>
          <span className="text-xs text-muted">
            ร้านยืนยันเมื่อ {thaiDate(new Date(payment.paidAt))} {formatClock(payment.paidAt)}
          </span>
        </>
      ) : (
        <>
          <span className="flex items-center gap-1.5 text-sm font-semibold">
            <QrCode aria-hidden="true" size={16} />
            {due}
          </span>
          <div
            role="img"
            aria-label={payment.mode === "promptpay" ? `QR พร้อมเพย์ ยอด ${formatBaht(total)}` : "QR ตัวอย่าง สแกนจ่ายจริงไม่ได้"}
            className="size-[188px] rounded-2xl bg-white p-2 [&>svg]:size-full"
            // SVG สร้างที่ server จากเลขพร้อมเพย์ของร้าน + ยอดเงิน (ไม่มีข้อความจากผู้ใช้)
            dangerouslySetInnerHTML={{ __html: payment.qrSvg }}
          />
          <span className="text-[22px] font-bold">{formatBaht(total)}</span>
          <span className="text-xs leading-[1.5] text-muted">
            {payment.mode === "promptpay"
              ? "สแกนจ่ายด้วยแอปธนาคาร (พร้อมเพย์) หรือโอนเข้าบัญชีร้านด้านล่าง"
              : "QR ตัวอย่าง สแกนจ่ายไม่ได้ · โอนเข้าบัญชีร้านด้านล่างแทน"}
          </span>
          <span className="rounded-full bg-accent-tint px-3 py-1 text-xs font-medium text-accent-ink">รอร้านยืนยันการชำระ</span>
        </>
      )}
    </section>
  );
}
