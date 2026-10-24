import type { Metadata } from "next";
import Link from "next/link";
import { storefront } from "@/lib/config/storefront";

export const metadata: Metadata = { title: `นโยบายความเป็นส่วนตัว — ${storefront.storeName}` };

// โครงตาม SKILL §10 (PDPA) — ข้อความเขียนจากสิ่งที่ระบบทำจริง (ทีมให้เติมเอง 24 ต.ค. 2569) ร้านจริงควรให้ผู้รู้กฎหมายตรวจก่อนใช้
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
  {
    title: "ผู้ให้บริการที่ร้านใช้",
    items: [
      "Supabase เก็บบัญชี แชต และออเดอร์ · Vercel ให้บริการเว็บไซต์",
      "OpenAI อ่านข้อความและแปลงเสียงพูดเป็นข้อความ · ElevenLabs สร้างเสียงตอบเมื่อคุณกดไมค์พูด",
    ],
  },
  {
    title: "ระยะเวลาที่เก็บ",
    items: ["เก็บไว้ตลอดที่บัญชียังใช้งาน เพื่อให้ร้านดูประวัติแชตและออเดอร์ย้อนหลังได้", "ขอให้ลบบัญชีและข้อมูลได้ทุกเมื่อผ่านช่องทางติดต่อของร้าน"],
  },
  {
    title: "สิทธิ์ของคุณ",
    items: [
      "ขอดู ขอสำเนา ขอแก้ไข หรือขอลบข้อมูลของคุณ และขอให้หยุดใช้ข้อมูลได้ ตาม พ.ร.บ.คุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562",
      `แจ้งร้านทาง ${storefront.contactChannel} หรือกด "คุยกับคนจริง" ในแชต`,
    ],
  },
  {
    title: "ติดต่อ",
    items: [`ผู้ควบคุมข้อมูล: ${storefront.storeName} (เจ้าของร้าน ${storefront.ownerName})`, `ช่องทางติดต่อ: ${storefront.contactChannel}`],
  },
];

export default function PrivacyPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[720px] flex-col gap-5 px-4 py-10">
      <div className="flex flex-col gap-1">
        <span className="text-[13px] text-muted">{storefront.storeName}</span>
        <h1 className="text-2xl font-semibold md:text-[28px]">นโยบายความเป็นส่วนตัว</h1>
        <p className="text-sm text-muted">มีผลตั้งแต่ 24 ต.ค. 2569</p>
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
      <div className="flex flex-wrap justify-center gap-x-6 gap-y-2">
        <Link href="/" className="text-sm font-semibold text-accent-ink">
          กลับไปแชต
        </Link>
        <Link href="/signup" className="text-sm font-semibold text-accent-ink">
          กลับไปหน้าสมัครสมาชิก
        </Link>
      </div>
    </main>
  );
}
