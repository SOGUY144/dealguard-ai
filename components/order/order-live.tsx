"use client";

import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { type ConnectLive, useLiveUpdates } from "@/components/live/use-live-updates";
import { connectOrder } from "@/lib/supabase/live";

/** ฟังออเดอร์นี้ — ร้านยืนยันรับเงินแล้ว ใบสรุปโหลดใหม่เอง (ไม่มีอะไรแสดงบนจอ) · test ใส่ connect ปลอมได้ */
export function OrderLive({ orderId, connect }: { orderId?: string; connect?: ConnectLive }) {
  const router = useRouter();
  const live = useMemo(() => connect ?? (orderId ? connectOrder(orderId) : null), [connect, orderId]);
  useLiveUpdates(live, () => router.refresh());
  return null;
}
