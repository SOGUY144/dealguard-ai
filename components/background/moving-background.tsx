"use client";

// พื้นหลังเคลื่อนไหว (เฟส 11) — วางทับ mesh เดิมของ .app-bg เฉพาะเมื่อไม่รบกวนผู้ใช้
// จอคอมเท่านั้น · ไม่เปิดเมื่อตั้ง "ลดการเคลื่อนไหว" · ไม่มี WebGL / ตัววาดพัง → เหลือ mesh เดิม หน้าไม่พัง
// three.js หนัก → โหลดแยกหลังหน้าขึ้นแล้ว และไม่โหลดเลยถ้าไม่เปิด
import { Component, useEffect, useState, type ComponentType, type ReactNode } from "react";

const DESKTOP = "(min-width: 768px)";
const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

export function canAnimateBackground(win: Window): boolean {
  if (!win.matchMedia(DESKTOP).matches || win.matchMedia(REDUCED_MOTION).matches) return false;
  try {
    const probe = win.document.createElement("canvas");
    return Boolean(probe.getContext("webgl2") ?? probe.getContext("webgl"));
  } catch {
    return false;
  }
}

type Loader = () => Promise<ComponentType>;
const loadGradient: Loader = () => import("./gradient-canvas").then((m) => m.GradientCanvas);

/** test ใส่ตัวโหลดปลอมได้ */
export function MovingBackground({ load = loadGradient }: { load?: Loader }) {
  const [Gradient, setGradient] = useState<ComponentType | null>(null);

  useEffect(() => {
    let alive = true;
    let loaded: ComponentType | null = null;
    // เปิด/ปิดตามสภาพตอนนี้ — ย่อหน้าต่างเป็นจอแคบ / เปิดลดการเคลื่อนไหวกลางทาง → ปิดทันที
    const sync = () => {
      if (!canAnimateBackground(window)) return setGradient(null);
      if (loaded) return setGradient(() => loaded);
      load().then(
        (C) => {
          loaded = C;
          if (alive && canAnimateBackground(window)) setGradient(() => C);
        },
        () => {},
      );
    };
    sync();
    const queries = [window.matchMedia(DESKTOP), window.matchMedia(REDUCED_MOTION)];
    for (const q of queries) q.addEventListener("change", sync);
    return () => {
      alive = false;
      for (const q of queries) q.removeEventListener("change", sync);
    };
  }, [load]);

  if (!Gradient) return null;
  return (
    <Fallback>
      <Gradient />
    </Fallback>
  );
}

/** ตัววาดพัง (WebGL หลุด ฯลฯ) → ไม่แสดงอะไร เหลือ mesh เดิมของ body */
class Fallback extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}
