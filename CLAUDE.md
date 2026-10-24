# DealGuard AI

- สเปกหลักของโปรเจกต์อยู่ใน `.claude/skills/dealguard-ai/SKILL.md` (สำเนาเดียวกับ `SKILL.md` ที่ root) อ่านก่อนเริ่มงาน
- ดีไซน์อยู่ใน `design/` (อ่าน `design/HANDOFF.md` ก่อนทำ UI — กล่อง "เปลี่ยนแปลงหลังส่งดีไซน์" ด้านบนทับข้อความในไฟล์ดีไซน์) แผนเฟสอยู่ใน `docs/PLAN.md`
- Next.js ที่ใช้คือ 16 ซึ่ง API ต่างจากที่เคยรู้ ดู `AGENTS.md` และอ่านคู่มือใน `node_modules/next/dist/docs/` ก่อนเขียนโค้ด Next
- คีย์ทั้งหมดอยู่ใน `.env.local` ซึ่งผู้ใช้ใส่เอง (แม่แบบคือ `.env.example`) เช็กด้วย `npm run check-keys`
- ฐานข้อมูล: `npm run db:migrate` (รัน SQL ใหม่ใน `supabase/migrations/`), `npm run db:seed`, `npm run test:db` (RLS บน Supabase จริง) — บัญชีเดโมอยู่ใน `.demo-accounts.local.md` ห้ามพิมพ์รหัสในแชต
  - เครื่องนี้กับเว็บบน Vercel ใช้ Supabase **โปรเจกต์เดียวกัน** — `db:migrate`, `test:db`, `demo:reset -- --yes` กระทบเว็บจริงทันที
  - `db:seed` ไม่เปลี่ยนรหัสบัญชีที่มีอยู่แล้ว อยากตั้งรหัสใหม่จากไฟล์: `npm run db:seed -- --reset-passwords`
- อย่ารัน `npm run build` หรือ `npm install` ระหว่างที่ `npm run dev` เปิดอยู่ — dev server จะค้าง (error "Jest worker…") ต้องปิดแล้วเปิดใหม่
  - ปิด dev server แล้วเช็กพอร์ต 3000 ด้วย — process ของ Next อาจยังค้างอยู่ (`next dev` บอก PID ไว้ถ้าเปิดซ้ำ)
- ทดสอบใน Browser pane ตอนหน้าต่างไม่ได้วาด (`requestAnimationFrame` ไม่ทำงาน) React จะไม่เผยเนื้อหาใน `<Suspense>` ที่ stream มา → หน้าไม่ hydrate กดส่งแล้วเป็นฟอร์ม GET ธรรมดา · ทดสอบ server ด้วย `fetch('/api/chat')` จากหน้าแทน
- เครื่องนี้เป็น Windows: `python3` คือ alias ของ Microsoft Store ใช้ไม่ได้ ให้ใช้ `python` แทนทุกครั้งที่สกิลสั่ง `python3`
