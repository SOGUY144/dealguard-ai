"use client";

import { useEffect, useSyncExternalStore } from "react";
import type { FormState } from "@/lib/auth/form-state";
import { welcomeStore } from "@/lib/welcome/store";

const noop = () => () => {};

/**
 * วางในฟอร์มล็อกอิน/สมัคร: บอก server ว่า JS ทำงานแล้ว (ช่อง js ใส่หลัง hydrate เท่านั้น)
 * server จึงตอบ welcome แทนการ redirect → เล่นคัตซีนต้อนรับใน root layout แล้วพาไปหน้าปลายทางเอง
 * ไม่มี JS = ไม่มีช่องนี้ → server redirect ตามปกติ ใช้งานได้เสมอ
 */
export function WelcomeHandoff({ welcome }: { welcome: FormState["welcome"] }) {
  const hydrated = useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );

  useEffect(() => {
    if (welcome) welcomeStore.play(welcome);
  }, [welcome]);

  return hydrated ? <input type="hidden" name="js" value="1" /> : null;
}
