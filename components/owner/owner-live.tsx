"use client";

import { WifiOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { type ConnectLive, type LiveStatus, useLiveUpdates } from "@/components/live/use-live-updates";
import { connectOwnerDashboard } from "@/lib/supabase/live";

export type { ConnectLive } from "@/components/live/use-live-updates";

/**
 * ลูกค้ากดยืนยัน / AI ส่งเรื่องให้เถ้าแก่ → ตัวเลขบนหน้านี้อัปเดตเอง (สคริปต์เดโมข้อ 3)
 * ต่อ Realtime ไม่ติด/หลุด → ดึงใหม่ทุก 10 วินาที และบอกเถ้าแก่ว่าไม่ใช่แบบสดแล้ว
 */
export function OwnerLive({ connect = connectOwnerDashboard }: { connect?: ConnectLive }) {
  const router = useRouter();
  const status = useLiveUpdates(connect, () => router.refresh());
  return <LiveStatusNote status={status} />;
}

export function LiveStatusNote({ status }: { status: LiveStatus }) {
  return (
    <p role="status" className={status === "offline" ? "flex items-center gap-1.5 text-xs text-warn-ink" : "sr-only"}>
      {status === "offline" && (
        <>
          <WifiOff aria-hidden="true" size={14} />
          การเชื่อมต่อแบบสดหลุด · อัปเดตทุก 10 วินาที
        </>
      )}
    </p>
  );
}
