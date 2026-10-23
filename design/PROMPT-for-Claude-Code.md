# คำสั่งเริ่มต้นสำหรับ Claude Code (คัดลอกไปวางได้เลย)

```
อ่านไฟล์เหล่านี้ก่อนเขียนโค้ด:
1. SKILL.md (สเปกระบบ DealGuard — กฎราคา, Deal Engine, ขอบเขต MVP)
2. design/HANDOFF.md (สเปกหน้าตา, components, routes, data types)
3. design/tokens.css และ design/tailwind.preset.js (design tokens)
4. design/screens/*.dc.html (ดีไซน์ต้นฉบับทุกจอ — ใช้เป็น reference หน้าตาและข้อความ ไม่ต้องรัน)

งาน: สร้างเว็บ DealGuard ด้วย Next.js (App Router) + TypeScript + Tailwind
ลำดับตาม SKILL หมวด 7:
  1) lib/deal-engine.ts — ฟังก์ชันล้วน + unit test (vitest) ตาม acceptance tests ใน SKILL รวม Floor Guard
  2) หน้า "/" แชตลูกค้า ตาม Main.dc.html (คอม) และ Mobile-Chat.dc.html (มือถือ) — responsive หน้าเดียว
  3) API route แปลงข้อความเป็น Intent JSON (Layer 1)
  4) ข้อความตอบ + OfferList + ยืนยันออเดอร์ (Layer 3) — ใช้ mock ก่อนถ้ายังไม่มี key
  5) Voice: VoiceBubble + fallback เป็นข้อความเมื่อ Voice API ล่ม (Mobile-NoVoice.dc.html)
  6) หน้า "/owner" ตาม Owner-Desktop / Owner-Mobile
  7) หน้า "/owner/products" ตาม Owner-Settings (ถ้าไม่ทัน ใช้ JSON ตายตัว)

กฎ:
- UI ห้ามคำนวณราคาเอง แสดงเฉพาะ offers จาก Deal Engine
- ฝั่งลูกค้าห้ามแสดงต้นทุน/ราคาพื้น/margin
- ใช้คลาส .glass .glass-clear .btn-primary .btn-secondary จาก tokens.css ห้ามใช้ปุ่มม่วงทึบ
- ไอคอน: lucide-react, AI = sparkle, ลูกค้าในหน้าเถ้าแก่ = user
- ข้อความภาษาไทยให้ใช้ตามไฟล์ดีไซน์ ส่วน [placeholder] ห้ามแต่งเอง
- ทำทีละขั้น รัน test ก่อนไปขั้นถัดไป
```
