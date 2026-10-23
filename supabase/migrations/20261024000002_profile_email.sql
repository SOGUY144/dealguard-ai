-- เก็บอีเมลผู้สมัครไว้ใน profiles ด้วย (ทีมตัดสินใจ 24 ต.ค. 2569)
-- ปิดยืนยันอีเมลแล้ว ลูกค้าสมัครด้วยอีเมลตัวเอง — เถ้าแก่ต้องเห็นอีเมลไว้ติดต่อกลับ
-- RLS เดิมยังใช้: ลูกค้าเห็นแค่ profile ตัวเอง · owner เห็นทุกคน

alter table public.profiles add column email text;

update public.profiles p
set email = u.email
from auth.users u
where u.id = p.id;

-- สมัครใหม่: ใส่อีเมลตอนสร้าง profile
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, display_name, privacy_accepted_at)
  values (
    new.id,
    new.email,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), split_part(new.email, '@', 1)),
    (new.raw_user_meta_data ->> 'privacy_accepted_at')::timestamptz
  );
  return new;
end;
$$;

-- เปลี่ยนอีเมลใน Auth: ให้ profiles ตามด้วย
create function public.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles set email = new.email where id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row
  when (old.email is distinct from new.email)
  execute function public.handle_user_email_change();
