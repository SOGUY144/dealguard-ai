import type { Metadata } from "next";
import Link from "next/link";
import { storefront } from "@/lib/config/storefront";

export const metadata: Metadata = { title: `นโยบายความเป็นส่วนตัว — ${storefront.storeName}` };

// โครงตาม SKILL §10 (PDPA) — ข้อความใน [วงเล็บเหลี่ยม] ต้องให้ทีมใส่ข้อความจริงก่อนใช้งานจริง ห้ามแต่งเอง
const SECTIONS = [
  {
    title: "ข้อมูลที่เราเก็บ",
    items: [
      "ชื่อที่ให้ร้านเรียก และอีเมลที่ใช้สมัคร",
      "ข้อความที่คุยกับผู้ช่วย AI และออเดอร์ที่ยืนยัน",
      "เสียงที่กดไมค์พูด จะถูกแปลงเป็นข้อความแล้วลบทิ้ง ไม่เก็บไฟล์เสียง",
    ],
  },
  {
    title: "เราใช้ข้อมูลทำอะไร",
    items: [
      "ตอบแชตและคำนวณข้อเสนอราคาให้คุณ",
      "ให้เจ้าของร้านตรวจย้อนหลังและตอบเรื่องที่ผู้ช่วย AI ส่งต่อ",
      "ไม่นำข้อมูลของคุณไปเทรนโมเดล AI",
    ],
  },
  { title: "ระยะเวลาที่เก็บ", items: ["[ระยะเวลาเก็บข้อมูล]"] },
  { title: "สิทธิ์ของคุณ", items: ["[สิทธิ์ของเจ้าของข้อมูลตาม PDPA และวิธีขอใช้สิทธิ์]"] },
  { title: "ติดต่อ", items: [`${storefront.storeName} · ${storefront.contactChannel}`, "[ผู้ควบคุมข้อมูล / เจ้าหน้าที่คุ้มครองข้อมูล]"] },
];

export default function PrivacyPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[720px] flex-col gap-5 px-4 py-10">
      <div className="flex flex-col gap-1">
        <span className="text-[13px] text-muted">{storefront.storeName}</span>
        <h1 className="text-2xl font-semibold md:text-[28px]">นโยบายความเป็นส่วนตัว</h1>
        <p className="text-sm text-muted">ฉบับร่าง — [วันที่มีผล]</p>
      </div>
      <div className="glass flex flex-col gap-5 rounded-card p-5 md:p-7">
        {SECTIONS.map((s) => (
          <section key={s.title} className="flex flex-col gap-2">
            <h2 className="text-[17px] font-semibold">{s.title}</h2>
            <ul className="list-disc space-y-1 pl-5 text-[15px] leading-[1.6]">
              {s.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      <Link href="/signup" className="self-center text-sm font-semibold text-accent-ink">
        กลับไปหน้าสมัครสมาชิก
      </Link>
    </main>
  );
}
