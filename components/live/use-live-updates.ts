"use client";

import { useEffect, useRef, useState } from "react";

/** รอให้เหตุการณ์ที่มาติดกันเข้าครบก่อนดึงครั้งเดียว */
const DEBOUNCE_MS = 300;
/** ต่อ Realtime ไม่ติดภายในเวลานี้ → ดึงใหม่เป็นรอบแทน */
const CONNECT_TIMEOUT_MS = 8_000;
const POLL_MS = 10_000;

export type LiveStatus = "connecting" | "live" | "offline";

/** ฟังการเปลี่ยนแปลง · คืนฟังก์ชันเลิกฟัง — แยกออกมาให้ test ใส่ของปลอมได้ */
export type ConnectLive = (onChange: () => void, onStatus: (status: "live" | "offline") => void) => () => void;

/**
 * ฟัง Realtime แล้วเรียก onUpdate · ต่อไม่ติด/หลุด (wifi บล็อก websocket) → เรียกทุก 10 วินาทีแทน
 * กลับมาที่แท็บ / ต่อกลับมาได้ → เรียกหนึ่งครั้ง เผื่อพลาดเหตุการณ์ระหว่างนั้น
 */
export function useLiveUpdates(connect: ConnectLive | null, onUpdate: () => void): LiveStatus {
  const [status, setStatus] = useState<LiveStatus>("connecting");
  const statusRef = useRef<LiveStatus>("connecting");
  // onUpdate เปลี่ยนทุก render ได้ — เก็บตัวล่าสุดไว้ ไม่ต้องต่อ Realtime ใหม่
  const update = useRef(onUpdate);
  useEffect(() => {
    update.current = onUpdate;
  }, [onUpdate]);

  useEffect(() => {
    if (!connect) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => update.current(), DEBOUNCE_MS);
    };
    const set = (next: LiveStatus) => {
      if (statusRef.current === "offline" && next === "live") refresh();
      statusRef.current = next;
      setStatus(next);
    };
    const giveUp = setTimeout(() => {
      if (statusRef.current === "connecting") set("offline");
    }, CONNECT_TIMEOUT_MS);
    const disconnect = connect(refresh, (next) => {
      clearTimeout(giveUp);
      set(next);
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
  }, [connect]);

  useEffect(() => {
    if (status !== "offline") return;
    const poll = setInterval(() => update.current(), POLL_MS);
    return () => clearInterval(poll);
  }, [status]);

  return status;
}
