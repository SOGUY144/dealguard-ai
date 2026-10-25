import { useId } from "react";
import { cn } from "@/lib/cn";

export type BotPose = "wave" | "chat" | "happy";

/** แขนหมุนรอบหัวไหล่ — 0° = ห้อยลง · บวก = ตามเข็ม (ปลายแขนไปทางซ้ายของจอ) */
const ARMS: Record<BotPose, { left: number; right: number }> = {
  wave: { left: 18, right: -125 },
  chat: { left: -38, right: 38 },
  // ชูสองแขนออกข้าง (ไม่ชนหัว)
  happy: { left: 118, right: -118 },
};

/**
 * มาสคอตผู้ช่วย AI (วาดเป็น SVG — คมทุกขนาด ขยับแขน/ตา/ท่าได้)
 * ลอยตัว ไม่มีขา · ท่าเปลี่ยนแบบมีจังหวะเด้ง (transition ที่ transform ของแขน)
 */
export function WelcomeBot({ pose, className }: { pose: BotPose; className?: string }) {
  const id = useId().replace(/:/g, "");
  const arms = ARMS[pose];
  const body = `${id}-body`;
  const screen = `${id}-screen`;
  const violet = `${id}-violet`;
  const glow = `${id}-glow`;
  const eye = `${id}-eye`;

  return (
    <svg viewBox="0 0 240 270" className={cn("overflow-visible", className)} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={body} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="1" stopColor="#E9E1FC" />
        </linearGradient>
        <linearGradient id={screen} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3A3C55" />
          <stop offset="1" stopColor="#1A1B2A" />
        </linearGradient>
        <linearGradient id={violet} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#A58BF5" />
          <stop offset="1" stopColor="#6646CF" />
        </linearGradient>
        <radialGradient id={glow}>
          <stop offset="0" stopColor="#9C83F0" stopOpacity="0.55" />
          <stop offset="1" stopColor="#9C83F0" stopOpacity="0" />
        </radialGradient>
        <filter id={eye} x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="3.5" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* แสงใต้ตัว — หดเข้าตอนตัวลอยขึ้น */}
      <ellipse className="wb-shadow" cx="120" cy="256" rx="70" ry="11" fill={`url(#${glow})`} />

      <g className="wb-float">
        {/* เสาอากาศ */}
        <line x1="120" y1="40" x2="120" y2="20" stroke="#CDBFF6" strokeWidth="5" strokeLinecap="round" />
        <circle className="wb-antenna" cx="120" cy="15" r="8" fill={`url(#${violet})`} />
        <circle cx="117" cy="12" r="2.5" fill="#FFFFFF" opacity="0.8" />

        {/* แขนซ้าย (ข้างหลังลำตัว) */}
        <Arm x={80} y={172} deg={arms.left} fill={`url(#${body})`} />

        {/* ลำตัว + โล่ */}
        <rect x="104" y="146" width="32" height="14" rx="6" fill="#DCD2F7" />
        <path
          d="M120 154 C161 154 174 182 170 207 C167 229 147 240 120 240 C93 240 73 229 70 207 C66 182 79 154 120 154 Z"
          fill={`url(#${body})`}
          stroke="#E2D8F7"
          strokeWidth="1.5"
        />
        <path d="M120 178 l17 6.5 v10.5 c0 11.5 -7.5 19 -17 23 c-9.5 -4 -17 -11.5 -17 -23 v-10.5 z" fill={`url(#${violet})`} />
        <path d="M112 197 l6 6 l10.5 -12" fill="none" stroke="#FFFFFF" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round" />

        {/* หัว */}
        <rect x="34" y="72" width="18" height="42" rx="8" fill={`url(#${violet})`} />
        <rect x="188" y="72" width="18" height="42" rx="8" fill={`url(#${violet})`} />
        <rect x="46" y="38" width="148" height="114" rx="48" fill={`url(#${body})`} stroke="#E2D8F7" strokeWidth="1.5" />
        <ellipse cx="84" cy="56" rx="22" ry="8" fill="#FFFFFF" opacity="0.9" transform="rotate(-18 84 56)" />
        <rect x="62" y="58" width="116" height="78" rx="33" fill={`url(#${screen})`} />
        <ellipse cx="96" cy="70" rx="16" ry="4" fill="#FFFFFF" opacity="0.08" />

        {/* หน้าจอ: ตา แก้ม ยิ้ม */}
        <g filter={`url(#${eye})`}>
          {pose === "happy" ? (
            <>
              <path d="M87 98 q11 -14 22 0" fill="none" stroke="#D3C3FF" strokeWidth="5.5" strokeLinecap="round" />
              <path d="M131 98 q11 -14 22 0" fill="none" stroke="#D3C3FF" strokeWidth="5.5" strokeLinecap="round" />
            </>
          ) : (
            <g className="wb-blink">
              <ellipse cx="98" cy="94" rx="9" ry="12" fill="#D3C3FF" />
              <ellipse cx="142" cy="94" rx="9" ry="12" fill="#D3C3FF" />
              <circle cx="101" cy="89" r="3" fill="#FFFFFF" />
              <circle cx="145" cy="89" r="3" fill="#FFFFFF" />
            </g>
          )}
          <path
            d={pose === "chat" ? "M113 115 q7 3 14 0" : "M108 113 q12 10 24 0"}
            fill="none"
            stroke="#D3C3FF"
            strokeWidth="4"
            strokeLinecap="round"
          />
        </g>
        <ellipse cx="80" cy="113" rx="7" ry="4.5" fill="#F4A7C8" opacity="0.55" />
        <ellipse cx="160" cy="113" rx="7" ry="4.5" fill="#F4A7C8" opacity="0.55" />

        {/* มือถือในมือ (ท่าคุยแชต) */}
        <g className={cn("wb-phone", pose === "chat" && "wb-phone-on")}>
          <rect x="100" y="182" width="40" height="58" rx="9" fill="#2B2D3E" />
          <rect x="104" y="187" width="32" height="46" rx="6" fill="#EFE9FD" />
          <rect x="108" y="193" width="18" height="7" rx="3.5" fill="#FFFFFF" />
          <rect x="114" y="204" width="18" height="7" rx="3.5" fill="#C9B8F7" />
          <rect x="108" y="215" width="14" height="7" rx="3.5" fill="#FFFFFF" />
        </g>

        {/* แขนขวา — ท่าโบกมือ = แกว่งไปมา */}
        <Arm x={160} y={172} deg={arms.right} fill={`url(#${body})`} waving={pose === "wave"} />
      </g>

      {/* ประกายตอนปิดดีล */}
      <g className={cn("wb-sparkles", pose === "happy" && "wb-sparkles-on")} fill="#9C83F0">
        <Sparkle x={36} y={40} s={1} />
        <Sparkle x={210} y={28} s={0.8} />
        <Sparkle x={220} y={150} s={0.6} />
        <Sparkle x={22} y={168} s={0.7} />
      </g>
    </svg>
  );
}

function Arm({
  x,
  y,
  deg,
  fill,
  waving = false,
}: {
  x: number;
  y: number;
  deg: number;
  fill: string;
  waving?: boolean;
}) {
  return (
    <g className="wb-arm" style={{ transform: `translate(${x}px, ${y}px) rotate(${deg}deg)` }}>
      <g className={waving ? "wb-wave" : undefined}>
        <rect x="-10" y="-4" width="20" height="46" rx="10" fill={fill} stroke="#E2D8F7" strokeWidth="1.5" />
        <circle cx="0" cy="46" r="11" fill={fill} stroke="#E2D8F7" strokeWidth="1.5" />
      </g>
    </g>
  );
}

function Sparkle({ x, y, s }: { x: number; y: number; s: number }) {
  return (
    <path
      transform={`translate(${x} ${y}) scale(${s})`}
      d="M0 -12 C1.5 -3 3 -1.5 12 0 C3 1.5 1.5 3 0 12 C-1.5 3 -3 1.5 -12 0 C-3 -1.5 -1.5 -3 0 -12 Z"
    />
  );
}
