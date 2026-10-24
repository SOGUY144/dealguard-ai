import Image from "next/image";
import { cn } from "@/lib/cn";

/**
 * รูปสินค้า — มีรูปที่เถ้าแก่อัปโหลดใช้รูปนั้น ไม่มีใช้วงไล่สีตามดีไซน์
 * เป็นภาพประกอบ (ชื่อสินค้าอยู่ข้างๆ เสมอ) จึงไม่มี alt
 */
export function ProductThumb({ src, className }: { src?: string; className?: string }) {
  if (src) {
    return (
      <Image
        src={src}
        alt=""
        width={160}
        height={160}
        // รูปอยู่ใน Supabase Storage ย่อมาแล้วตอนอัปโหลด (800px) — ไม่ต้องผ่านตัวย่อรูปของ Next
        unoptimized
        className={cn("shrink-0 bg-accent-tint object-cover", className)}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className={cn("shrink-0", className)}
      style={{ background: "radial-gradient(circle at 30% 25%, #FFFFFF 0, #EEE5FD 45%, #D6C8F8 100%)" }}
    />
  );
}
