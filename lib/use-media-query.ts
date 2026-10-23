"use client";

import { useSyncExternalStore } from "react";

/** breakpoint เดียวของดีไซน์ (HANDOFF §3) */
export const DESKTOP_QUERY = "(min-width: 768px)";

/** ฝั่ง server คืน false (มือถือ) แล้ว browser อัปเดตเองหลัง hydrate */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}
