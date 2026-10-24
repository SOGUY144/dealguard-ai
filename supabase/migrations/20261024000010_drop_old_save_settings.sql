-- ลบ save_product_settings ตัวเดิม (ไม่มี p_name) — เก็บไว้ใน 0009 ให้เว็บที่ deploy อยู่ใช้ระหว่างรอโค้ดใหม่
-- โค้ดใหม่ (commit 94c7f2a) ขึ้น Vercel แล้ว เรียกเฉพาะตัวที่มี p_name
drop function if exists public.save_product_settings(text, numeric, numeric, numeric, jsonb, numeric, integer, boolean, numeric, numeric, jsonb);
