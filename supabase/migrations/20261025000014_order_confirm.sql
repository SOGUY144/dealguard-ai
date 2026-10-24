-- เถ้าแก่ยืนยันออเดอร์ (ทีมเลือกแบบที่ 1 25 ต.ค. 2569): ลูกค้าปิดดีล → รอยืนยัน → เถ้าแก่กด "ยืนยันออเดอร์" → รอชำระ → "ได้รับเงินแล้ว"
-- null = รอเถ้าแก่ยืนยัน (ลูกค้ายังไม่เห็น QR) · เขียนผ่าน server action ที่เช็กว่าเป็นเถ้าแก่แล้ว (service role) — ลูกค้าอ่านได้อย่างเดียว (RLS เดิม)

alter table public.orders add column if not exists confirmed_at timestamptz;

-- ออเดอร์ก่อนมีขั้นยืนยัน ถือว่ายืนยันแล้ว — ไม่งั้นทุกออเดอร์เก่าขึ้นเป็นรอยืนยัน และใบสรุปที่ลูกค้าเคยเห็น QR จะหายไป
update public.orders set confirmed_at = coalesce(paid_at, created_at) where confirmed_at is null;
