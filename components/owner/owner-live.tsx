"use client";

import { WifiOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

/** รอให้เหตุการณ์ที่มาติดกัน (ออเดอร์ + ข้อความ) เข้าครบก่อนโหลดหน้าใหม่ครั้งเดียว */
const REFRESH_DEBOUNCE_MS = 300;
/** ต่อ Realtime ไม่ติดภายในเวลานี้ → ดึงตัวเลขใหม่เป็นรอบแทน */
const CONNECT_TIMEOUT_MS = 8_000;
const POLL_MS = 10_000;

export type LiveStatus = "connecting" | "live" | "offline";

/** ฟังการเปลี่ยนแปลง · คืนฟังก์ชันเลิกฟัง — แยกออกมาให้ test ใส่ของปลอมได้ */
export type ConnectLive = (onChange: () => void, onStatus: (status: "live" | "offline") => void) => () => void;

const connectSupabase: ConnectLive = (onChange, onStatus) => {
  const supabase = getSupabaseBrowserClient();
  // ชื่อช่องไม่ซ้ำต่อการเปิดหน้า: ช่องเก่าที่กำลังปิด (กลับหน้าเร็วๆ / StrictMode) จะไม่ถูกเอามาใช้ซ้ำแล้วเงียบ
  let disposed = false;
  const channel = supabase
    .channel(`owner-dashboard-${crypto.randomUUID()}`)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "orders" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "escalations" }, onChange)
    .subscribe((status: string) => {
      // CLOSED ตอนเราเลิกฟังเองไม่ใช่การหลุด
      if (disposed) return;
      if (status === "SUBSCRIBED") onStatus("live");
      else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") onStatus("offline");
    });
  return () => {
    disposed = true;
    void supabase.removeChannel(channel);
  };
};

/**
 * ลูกค้ากดยืนยัน / AI ส่งเรื่องให้เถ้าแก่ → ตัวเลขบนหน้านี้อัปเดตเอง (สคริปต์เดโมข้อ 3)
 * Realtime ส่งเฉพาะแถวที่ owner อ่านได้ตาม RLS · ต่อไม่ติด/หลุด (เช่น wifi ที่งานบล็อก websocket)
 * → ดึงใหม่ทุก 10 วินาที + ทุกครั้งที่กลับมาที่แท็บนี้ และบอกเถ้าแก่ว่าไม่ใช่แบบสดแล้ว
 */
export function OwnerLive({ connect = connectSupabase }: { connect?: ConnectLive }) {
  const router = useRouter();
  const [status, setStatus] = useState<LiveStatus>("connecting");
  const statusRef = useRef<LiveStatus>("connecting");

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), REFRESH_DEBOUNCE_MS);
    };
    const update = (next: LiveStatus) => {
      // กลับมาต่อติด → ดึงครั้งหนึ่ง เผื่อพลาดเหตุการณ์ระหว่างหลุด
      if (statusRef.current === "offline" && next === "live") refresh();
      statusRef.current = next;
      setStatus(next);
    };
    const giveUp = setTimeout(() => {
      if (statusRef.current === "connecting") update("offline");
    }, CONNECT_TIMEOUT_MS);
    const disconnect = connect(refresh, (next) => {
      clearTimeout(giveUp);
      update(next);
    });
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(timer);
      clearTimeout(giveUp);
      document.removeEventListener("visibilitychange", onVisible);
      disconnect();
    };
  }, [connect, router]);

  useEffect(() => {
    if (status !== "offline") return;
    const poll = setInterval(() => router.refresh(), POLL_MS);
    return () => clearInterval(poll);
  }, [status, router]);

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
