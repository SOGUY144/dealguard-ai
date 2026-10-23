import { Lock, VolumeX } from "lucide-react";
import { cn } from "@/lib/cn";

const NOTICES = {
  price_locked: { icon: Lock, text: "ราคาล็อกโดยระบบของร้าน" },
  voice_unavailable: { icon: VolumeX, text: "ข้อความเสียงยังไม่พร้อม ตอบเป็นข้อความแทน" },
} as const;

/** chip สถานะระบบ — price_locked อยู่กลางจอ, voice_unavailable อยู่ในกลุ่มคำตอบของ AI */
export function SystemNotice({ kind }: { kind: keyof typeof NOTICES }) {
  const { icon: Icon, text } = NOTICES[kind];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-[#EFEAF8] bg-white/85 px-3 py-1 text-xs text-[#4A4C63]",
        kind === "price_locked" ? "self-center py-[5px]" : "self-start px-2.5",
      )}
    >
      <Icon aria-hidden="true" size={13} strokeWidth={2.2} className="text-accent-ink" />
      {text}
    </span>
  );
}
