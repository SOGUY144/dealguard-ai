import type { CSSProperties } from "react";
import { cn } from "@/lib/cn";

const COLORS = ["#7A5AE0", "#F4A7C8", "#8FD3B6", "#FFC861", "#9CC3FF", "#B9A3F5"];
const COUNT = 28;

/**
 * กระดาษสีพุ่งออกจากจุดกลางแล้วร่วงลง (ครั้งเดียว ~1.3 วินาที)
 * ตำแหน่งคำนวณตายตัว (มุมทองคำ) — render ที่ server กับ browser ได้ผลเหมือนกัน · ปิดเองเมื่อตั้งค่าลดการเคลื่อนไหว
 */
const PIECES = Array.from({ length: COUNT }, (_, i) => {
  const angle = (i * 137.5 * Math.PI) / 180;
  const dist = 70 + ((i * 37) % 70);
  return {
    tx: Math.round(Math.cos(angle) * dist * 1.25),
    ty: Math.round(Math.sin(angle) * dist * 0.9 - 30),
    rot: (i * 53) % 360,
    color: COLORS[i % COLORS.length],
    round: i % 3 === 0,
    size: 6 + (i % 4),
    delay: (i % 6) * 18,
  };
});

export function ConfettiBurst({ className }: { className?: string }) {
  return (
    <span aria-hidden="true" className={cn("confetti pointer-events-none absolute size-0", className)}>
      {PIECES.map((p, i) => (
        <i
          key={i}
          style={
            {
              "--tx": `${p.tx}px`,
              "--ty": `${p.ty}px`,
              "--r": `${p.rot}deg`,
              width: p.size,
              height: p.round ? p.size : p.size * 0.5,
              borderRadius: p.round ? 999 : 2,
              background: p.color,
              animationDelay: `${p.delay}ms`,
            } as CSSProperties
          }
        />
      ))}
    </span>
  );
}
