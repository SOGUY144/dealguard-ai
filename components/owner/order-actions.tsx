"use client";

// สถานะออเดอร์ + ปุ่มขั้นถัดไป: รอยืนยัน → [ยืนยันออเดอร์] → รอชำระ → [ได้รับเงินแล้ว] (PaidToggle เดิม)
import { BadgeCheck, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { buttonClass } from "@/components/ui/button";
import type { ConfirmResult } from "@/lib/owner/payments";
import { PaidToggle, type MarkPaid } from "./paid-toggle";

/** ฝั่ง client ได้แค่ผลที่ต้องใช้ (ไม่ต้องรู้ว่าเป็นครั้งแรกไหม) */
export type ConfirmOrder = (orderId: string) => Promise<{ ok: true; confirmedAt: string } | Extract<ConfirmResult, { ok: false }>>;

type Props = {
  orderId: string;
  buyerName: string;
  confirmedAt: string | null;
  paidAt: string | null;
  confirm: ConfirmOrder;
  markPaid: MarkPaid;
};

export function OrderActions({ orderId, buyerName, confirmedAt: initial, paidAt, confirm, markPaid }: Props) {
  const router = useRouter();
  const [confirmedAt, setConfirmedAt] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ได้รับเงินแล้ว = ยืนยันแล้ว (ข้อมูลก่อนมีขั้นยืนยัน) · ยืนยันแล้ว → ปุ่มรับเงินแบบเดิม
  if (paidAt || confirmedAt) {
    return <PaidToggle orderId={orderId} buyerName={buyerName} paidAt={paidAt} markPaid={markPaid} />;
  }

  async function onConfirm() {
    setBusy(true);
    setError(null);
    try {
      const result = await confirm(orderId);
      if (!result.ok) return setError(result.error);
      setConfirmedAt(result.confirmedAt);
      router.refresh();
    } catch (err) {
      // ไม่ถึงโค้ดฝั่ง server (ฝั่งนั้นลง log เอง) — เก็บสาเหตุไว้ใน console ให้ตามได้
      console.error("[orders]", err);
      setError("บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <span className="rounded-full bg-warn-bg px-2.5 py-1 text-xs font-semibold text-warn-ink">รอยืนยัน</span>
      <button
        type="button"
        disabled={busy}
        onClick={() => void onConfirm()}
        aria-label={`ยืนยันออเดอร์ · ${buyerName}`}
        className={buttonClass("primary", "h-9 min-h-0 px-3 text-xs font-semibold")}
      >
        {busy ? <LoaderCircle aria-hidden="true" size={13} className="motion-safe:animate-spin" /> : <BadgeCheck aria-hidden="true" size={13} />}
        ยืนยันออเดอร์
      </button>
      {error && (
        <span role="alert" className="text-xs text-warn-ink">
          {error}
        </span>
      )}
    </span>
  );
}
