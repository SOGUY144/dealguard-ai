-- ลูกค้า 1 คนมีแชตเดียวต่อร้าน — กันเปิดสองแท็บพร้อมกันแล้วได้สองแชต (ข้อความ/ข้อเสนอแยกกันจนงง)
-- แชตซ้ำที่มีอยู่แล้ว: เก็บแชตแรกไว้ ลบแชตที่สร้างทีหลัง (ข้อความ/ข้อเสนอของแชตนั้นลบตาม)
delete from public.chats c
using public.chats keep
where keep.merchant_id = c.merchant_id
  and keep.buyer_id = c.buyer_id
  and (keep.created_at, keep.id) < (c.created_at, c.id);

alter table public.chats add constraint chats_one_per_buyer unique (merchant_id, buyer_id);
