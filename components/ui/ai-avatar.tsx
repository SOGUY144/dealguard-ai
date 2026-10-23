import { cn } from "@/lib/cn";

/** ดาวประกายของดีไซน์ = สัญลักษณ์ของ AI ทุกที่ที่ลูกค้าเห็น (HANDOFF §1) */
export function SparkleIcon({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 2l1.8 5.6L19.5 9.5l-5.7 1.9L12 17l-1.8-5.6L4.5 9.5l5.7-1.9z" />
      <path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" />
    </svg>
  );
}

/**
 * header = วงกลมไล่สีม่วง (40 มือถือ / 44 คอม) · message = วงกลมม่วงอ่อน (30 มือถือ / 34 คอม)
 */
export function AiAvatar({ variant }: { variant: "header" | "message" }) {
  if (variant === "header") {
    return (
      <span
        aria-hidden="true"
        className="grid size-10 shrink-0 place-items-center rounded-full text-white shadow-[0_6px_16px_rgba(122,90,224,0.30)] md:size-11"
        style={{ background: "radial-gradient(circle at 30% 25%, #C4AEFB 0, #9A7CEE 50%, #7A5AE0 100%)" }}
      >
        <SparkleIcon size={22} className="size-5 md:size-[22px]" />
      </span>
    );
  }
  return (
    <span
      aria-hidden="true"
      className={cn("grid size-[30px] shrink-0 place-items-center rounded-full bg-accent-tint text-accent md:size-[34px]")}
    >
      <SparkleIcon size={16} className="size-3.5 md:size-4" />
    </span>
  );
}
