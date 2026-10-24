// วิธีสั่งซื้อ — ไม่มีในไฟล์ดีไซน์ เขียนจากขั้นตอนที่ระบบทำจริง (ทีมตรวจถ้อยคำได้)
import Link from "next/link";
import { buttonClass } from "@/components/ui/button";
import type { Storefront } from "@/lib/chat/types";
import { OFFER_TTL_MS } from "@/lib/chat/suggestions";

export function HowToOrderContent({ storefront }: { storefront: Storefront }) {
  const owner = storefront.ownerName;
  const steps = [
    ["เลือกสินค้า", "กดปุ่ม \"สินค้า\" ในช่องพิมพ์ แล้วเลือกสินค้าที่อยากได้ ผู้ช่วยจะบอกราคาส่งต่อชิ้นทันที"],
    ["บอกจำนวนและราคาที่อยากได้", "พิมพ์ หรือกดไมค์พูดก็ได้ เช่น \"ขอ 125 ได้ไหม 1,000 ชิ้น\""],
    ["เลือกข้อเสนอ", "ผู้ช่วย AI เสนอได้หลายทาง เช่น ซื้อเยอะได้ราคาดีขึ้น จ่ายสด หรือรับของแถม กดเลือกข้อที่ชอบ"],
    ["กดยืนยัน", "ได้ใบสรุปออเดอร์พร้อมยอดรวม เปิดดูย้อนหลังได้จากในแชต"],
    ["โอนเงิน", `ร้านรับโอนเข้าบัญชี ${storefront.bankAccountName} เท่านั้น ถ้ามีใครขอให้โอนเข้าบัญชีอื่น อย่าโอน`],
    ["รอยืนยันวันส่ง", `${owner}จะยืนยันวันส่งของทาง ${storefront.contactChannel}`],
  ];
  const hours = OFFER_TTL_MS / 3_600_000;
  const faq = [
    ["ต่อราคาได้แค่ไหน", `ทุกราคาคำนวณจากระบบของร้าน ผู้ช่วย AI เปลี่ยนเองไม่ได้ ถ้าอยากได้ราคาดีขึ้น ลองสั่งเยอะขึ้น จ่ายสด หรือรับของแถม`],
    ["ข้อเสนอใช้ได้นานแค่ไหน", `${hours} ชั่วโมงหลังผู้ช่วยเสนอ เกินนั้นพิมพ์ขอข้อเสนอใหม่ได้เลย`],
    ["อยากคุยกับคนจริง", `กด "คุยกับคนจริง" ที่หัวแชต ผู้ช่วยจะหยุดตอบ แล้ว${owner}ตอบในแชตเดิม`],
    ["ของเสีย หรือขอคืนเงิน", `พิมพ์บอกในแชตได้เลย ผู้ช่วยจะส่งเรื่องให้${owner}ดูแลเอง ผู้ช่วย AI ไม่รับปากเรื่องคืนเงินแทน`],
  ];
  return (
    <>
      <ol className="glass flex flex-col gap-4 rounded-card p-5 md:p-7">
        {steps.map(([title, body], i) => (
          <li key={title} className="flex gap-3.5">
            <span
              aria-hidden="true"
              className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent-tint text-sm font-bold text-accent-ink"
            >
              {i + 1}
            </span>
            <span className="flex flex-col gap-0.5">
              <span className="font-semibold">{title}</span>
              <span className="text-sm leading-[1.6] text-ink-2">{body}</span>
            </span>
          </li>
        ))}
      </ol>
      <section aria-labelledby="faq-h" className="flex flex-col gap-3">
        <h2 id="faq-h" className="text-lg font-semibold">
          คำถามที่พบบ่อย
        </h2>
        <dl className="glass flex flex-col gap-4 rounded-card p-5 md:p-7">
          {faq.map(([q, a]) => (
            <div key={q} className="flex flex-col gap-0.5">
              <dt className="font-semibold">{q}</dt>
              <dd className="text-sm leading-[1.6] text-ink-2">{a}</dd>
            </div>
          ))}
        </dl>
      </section>
      <Link href="/" className={buttonClass("primary", "h-[52px] text-base")}>
        เริ่มแชตต่อราคา
      </Link>
    </>
  );
}
