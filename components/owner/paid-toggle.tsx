"use client";

// สถานะชำระเงินของดีล + ปุ่ม "ได้รับเงินแล้ว" (เถ้าแก่เช็กยอดในแอปธนาคารแล้วกดเอง) · กดผิดยกเลิกได้
import { Check, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { buttonClass } from "@/components/ui/button";
import { formatClock } from "@/lib/format";
import type { PaidResult } from "@/lib/owner/payments";

export type MarkPaid = (orderId: string, paid: boolean) => Promise<PaidResult>;

type Props = { orderId: string; buyerName: string; paidAt: string | null; markPaid: MarkPaid };

export function PaidToggle({ orderId, buyerName, paidAt: initial, markPaid }: Props) {
  const router = useRouter();
  const [paidAt, setPaidAt] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function set(paid: boolean) {
    setBusy(true);
    setError(null);
    try {
      const result = await markPaid(orderId, paid);
      if (!result.ok) return setError(result.error);
      setPaidAt(result.paidAt);
      router.refresh();
    } catch {
      setError("บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      {paidAt ? (
        <>
          <span className="inline-flex items-center gap-1 rounded-full bg-ok-bg px-2.5 py-1 text-xs font-semibold text-ok-ink">
            <Check aria-hidden="true" size={13} />
            ชำระแล้ว {formatClock(paidAt)}
          </span>
          <button
            type="button"
            disabled={busy}
            onClick={() => void set(false)}
            aria-label={`ยกเลิกสถานะชำระแล้ว · ${buyerName}`}
            className={buttonClass("ghost", "h-9 min-h-0 px-2 text-xs text-muted")}
          >
            ยกเลิก
          </button>
        </>
      ) : (
        <>
          <span className="rounded-full bg-accent-tint px-2.5 py-1 text-xs font-medium text-accent-ink">รอชำระ</span>
          <button
            type="button"
            disabled={busy}
            onClick={() => void set(true)}
            aria-label={`ได้รับเงินแล้ว · ${buyerName}`}
            className={buttonClass("secondary", "h-9 min-h-0 px-3 text-xs font-medium")}
          >
            {busy && <LoaderCircle aria-hidden="true" size={13} className="motion-safe:animate-spin" />}
            ได้รับเงินแล้ว
          </button>
        </>
      )}
      {error && (
        <span role="alert" className="text-xs text-warn-ink">
          {error}
        </span>
      )}
    </span>
  );
}
