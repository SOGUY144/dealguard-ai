-- ลำดับข้อความออกโดยฐานข้อมูล ไม่ใช้นาฬิกาของ server (บน Vercel แต่ละเครื่องเวลาเหลื่อมกันได้ → ข้อความสลับ)
alter table public.messages add column seq bigint generated always as identity;
create index messages_chat_seq_idx on public.messages (chat_id, seq);
drop index if exists public.messages_chat_idx;

-- มีข้อความใหม่ → แชตขยับขึ้นบนสุดในหน้าเถ้าแก่ (ทำใน DB แทนการยิงคำสั่งแยกทุกครั้ง)
create function public.touch_chat_on_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.chats set updated_at = now() where id = new.chat_id;
  return null;
end;
$$;
revoke execute on function public.touch_chat_on_message() from public, anon, authenticated;

create trigger messages_touch_chat
  after insert on public.messages
  for each row execute function public.touch_chat_on_message();
