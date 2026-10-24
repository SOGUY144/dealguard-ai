-- โหมดถามข้อมูลทั่วไป (SKILL §11.3): คำตอบเรื่องส่งของ / สต๊อก ที่เถ้าแก่กรอกเอง
-- ผู้ช่วยตอบด้วยข้อความนี้ตรงตัว (ไม่ผ่าน LLM) · ว่าง = ยังไม่กรอก ผู้ช่วยบอกลูกค้าว่ายังตอบเรื่องนั้นไม่ได้
-- เขียนผ่าน server action ที่เช็กว่าเป็นเถ้าแก่แล้ว (service role) เหมือนการตั้งค่าอื่น — ไม่เปิดสิทธิ์เขียนให้ใคร

alter table public.merchants
  add column if not exists delivery_info text not null default '' check (char_length(delivery_info) <= 300),
  add column if not exists stock_info text not null default '' check (char_length(stock_info) <= 300);
