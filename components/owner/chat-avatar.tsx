import { cn } from "@/lib/cn";
import { headInitials, headTone } from "@/lib/owner/chat-heads";

// สีพื้น/ตัวอักษรของวงกลมลูกค้า (คนเดิมสีเดิม) — ตัวอักษรเข้มบนพื้นอ่อน อ่านชัดทุกสี
const TONES = [
  "bg-[#E9E3FF] text-[#4B2FC2]",
  "bg-[#FFE3EE] text-[#A01E50]",
  "bg-[#DDF3E8] text-[#1A6B43]",
  "bg-[#FFEBD2] text-[#8F4A00]",
  "bg-[#DFEBFF] text-[#1F4FA8]",
  "bg-[#F3E2FA] text-[#7A2596]",
];

/** วงกลมชื่อย่อลูกค้า — ใช้ทั้งหัวแชตลอยและรายการแชต */
export function ChatAvatar({ chatId, name, className }: { chatId: string; name: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full font-semibold select-none",
        TONES[headTone(chatId, TONES.length)],
        className,
      )}
    >
      {headInitials(name)}
    </span>
  );
}
