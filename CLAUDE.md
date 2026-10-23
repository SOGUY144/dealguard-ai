# DealGuard AI

- สเปกหลักของโปรเจกต์อยู่ใน `.claude/skills/dealguard-ai/SKILL.md` (สำเนาเดียวกับ `SKILL.md` ที่ root) อ่านก่อนเริ่มงาน
- ดีไซน์อยู่ใน `design/` (อ่าน `design/HANDOFF.md` ก่อนทำ UI — กล่อง "เปลี่ยนแปลงหลังส่งดีไซน์" ด้านบนทับข้อความในไฟล์ดีไซน์) แผนเฟสอยู่ใน `docs/PLAN.md`
- Next.js ที่ใช้คือ 16 ซึ่ง API ต่างจากที่เคยรู้ ดู `AGENTS.md` และอ่านคู่มือใน `node_modules/next/dist/docs/` ก่อนเขียนโค้ด Next
- คีย์ทั้งหมดอยู่ใน `.env.local` ซึ่งผู้ใช้ใส่เอง (แม่แบบคือ `.env.example`) เช็กด้วย `npm run check-keys`
- ฐานข้อมูล: `npm run db:migrate` (รัน SQL ใหม่ใน `supabase/migrations/`), `npm run db:seed`, `npm run test:db` (RLS บน Supabase จริง) — บัญชีเดโมอยู่ใน `.demo-accounts.local.md` ห้ามพิมพ์รหัสในแชต
- อย่ารัน `npm run build` หรือ `npm install` ระหว่างที่ `npm run dev` เปิดอยู่ — dev server จะค้าง (error "Jest worker…") ต้องปิดแล้วเปิดใหม่
- เครื่องนี้เป็น Windows: `python3` คือ alias ของ Microsoft Store ใช้ไม่ได้ ให้ใช้ `python` แทนทุกครั้งที่สกิลสั่ง `python3`
