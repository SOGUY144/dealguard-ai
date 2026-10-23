import { User } from "lucide-react";

type Props = { ownerName: string; subject: string; orderRef?: string; contactChannel: string };

/** การ์ดส่งเรื่องให้เถ้าแก่ (Mobile-Escalate) — โทนปกติ ไม่ใช้สีส้ม เพราะส้มสงวนไว้ให้หน้าเถ้าแก่ */
export function HandoffCard({ ownerName, subject, orderRef, contactChannel }: Props) {
  return (
    <div className="my-1 flex flex-col gap-3 rounded-[22px] border border-line-soft bg-white p-4 shadow-[0_6px_18px_rgba(110,90,170,0.08)]">
      <div className="flex items-center gap-3">
        <span aria-hidden="true" className="grid size-11 shrink-0 place-items-center rounded-full bg-accent-tint text-accent">
          <User size={20} strokeWidth={2} />
        </span>
        <div className="flex flex-col">
          <span className="text-[15px] font-semibold">ส่งเรื่องให้{ownerName}แล้ว</span>
          <span className="flex items-center gap-1.5 text-xs text-accent-ink">
            <span aria-hidden="true" className="size-[7px] rounded-full bg-accent" />
            รอ{ownerName}ตอบ
          </span>
        </div>
      </div>
      <dl className="flex flex-col gap-1.5 border-t border-dashed border-line pt-2.5 text-[13px]">
        <Row label="เรื่อง" value={subject} />
        {orderRef && <Row label="ออเดอร์" value={orderRef} />}
        <Row label="ช่องทางตอบกลับ" value={`แชตนี้ หรือ ${contactChannel}`} />
      </dl>
      <p className="text-xs leading-normal text-muted">ผู้ช่วย AI จะไม่รับปากเรื่องคืนเงินหรือส่วนลดแทน{ownerName}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}
