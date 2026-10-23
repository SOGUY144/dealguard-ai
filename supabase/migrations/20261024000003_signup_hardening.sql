-- ไม่เชื่อข้อมูลจาก browser ตอนสมัคร (พบจากการรีวิวความปลอดภัย 24 ต.ค. 2569)
-- ใครก็เรียก /auth/v1/signup ตรงได้ด้วย publishable key — ข้ามฟอร์มของเรา จึงต้องบังคับที่ฐานข้อมูล
--   * ต้องยอมรับนโยบายความเป็นส่วนตัว (privacy_accepted = true) ไม่งั้นสมัครไม่ได้ (PDPA)
--   * เวลาที่ยอมรับ = เวลาของ server เสมอ ไม่รับค่าที่ส่งมา
--   * ล้างตัวอักษรควบคุมออกจากชื่อ (ชื่อจะไปอยู่ในหน้าเถ้าแก่และ prompt ของ AI)
-- บัญชีที่สร้างด้วย admin/seed ก็ต้องส่ง privacy_accepted: true เหมือนกัน

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  clean_name text;
begin
  if coalesce((new.raw_user_meta_data ->> 'privacy_accepted')::boolean, false) is not true then
    raise exception 'privacy policy must be accepted' using errcode = 'check_violation';
  end if;

  clean_name := left(trim(regexp_replace(coalesce(new.raw_user_meta_data ->> 'display_name', ''), '[[:cntrl:]]', '', 'g')), 80);

  insert into public.profiles (id, email, display_name, privacy_accepted_at)
  values (
    new.id,
    new.email,
    coalesce(nullif(clean_name, ''), split_part(new.email, '@', 1)),
    now()
  );
  return new;
end;
$$;
