-- แก้จากการรีวิว 24 ต.ค. 2569
-- 1) ตัวนับต่ำกว่าพื้น/หลอกระบบย้ายออกจาก chats (ลูกค้าอ่าน chats ได้ → เดาราคาพื้นได้จากการที่ตัวนับขึ้น/รีเซ็ต)
-- 2) การ์ดข้อเสนอ 1 ใบเป็นออเดอร์ได้ครั้งเดียว (กดยืนยันข้อ A กับ B พร้อมกันจากสองแท็บ)
-- 3) เขียนที่ต้องไปด้วยกันทำในคำสั่งเดียว: ข้อเสนอ+margin, ส่งเรื่อง+โหมด human, ออเดอร์+หักสต๊อกของแถม
-- 4) ตัวนับจำนวนครั้ง (rate limit) สำหรับล็อกอิน/สมัคร/แชต

-- ───────────────────────── 1) ตัวนับการต่อราคา — owner อ่านได้คนเดียว ─────────────────────────
create table public.chat_negotiation (
  chat_id uuid primary key references public.chats (id) on delete cascade,
  below_floor_count integer not null default 0 check (below_floor_count >= 0),
  injection_count integer not null default 0 check (injection_count >= 0)
);

insert into public.chat_negotiation (chat_id, below_floor_count, injection_count)
select id, below_floor_count, injection_count from public.chats;

alter table public.chats drop column below_floor_count, drop column injection_count;

-- แชตใหม่ได้แถวตัวนับเองเสมอ (server ไม่ต้องจำว่าต้องสร้าง)
create function public.create_chat_negotiation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.chat_negotiation (chat_id) values (new.id);
  return new;
end;
$$;
revoke execute on function public.create_chat_negotiation() from public, anon, authenticated;

create trigger chats_create_negotiation
  after insert on public.chats
  for each row execute function public.create_chat_negotiation();

alter table public.chat_negotiation enable row level security;
create policy "owner reads negotiation" on public.chat_negotiation for select to authenticated using (public.is_owner());
grant select on public.chat_negotiation to authenticated;
grant all on public.chat_negotiation to service_role;
-- ไม่ใส่ใน Realtime publication — ลูกค้าไม่ต้องได้ยินตัวนับ

-- ───────────────────────── 2) การ์ดข้อเสนอ 1 ใบ = ออเดอร์ได้ 1 ครั้ง ─────────────────────────
alter table public.orders add column offer_message_id uuid references public.messages (id) on delete cascade;
update public.orders o set offer_message_id = f.message_id from public.offers f where f.id = o.offer_id;
alter table public.orders add constraint orders_one_per_offer_card unique (offer_message_id);

-- ───────────────────────── 3) เขียนที่ต้องไปด้วยกันในคำสั่งเดียว ─────────────────────────
-- ข้อเสนอ + margin (ถ้า margin เขียนไม่ได้ ข้อเสนอก็ไม่ถูกเก็บ → ไม่มีออเดอร์ที่หน้าเถ้าแก่มองไม่เห็น)
create function public.save_offers(p_chat uuid, p_message uuid, p_sku text, p_offers jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  item jsonb;
  new_offer uuid;
begin
  for item in select * from jsonb_array_elements(p_offers) loop
    insert into public.offers (
      chat_id, message_id, letter, lever, sku, label, price_per_unit, qty, condition_text, total, credit_days, bundle
    ) values (
      p_chat, p_message, item ->> 'letter', item ->> 'lever', p_sku, item ->> 'label',
      (item ->> 'price_per_unit')::numeric, (item ->> 'qty')::integer, item ->> 'condition_text',
      (item ->> 'total')::numeric, (item ->> 'credit_days')::integer, nullif(item -> 'bundle', 'null'::jsonb)
    ) returning id into new_offer;

    insert into public.offer_economics (
      offer_id, margin_if_conceded, margin_offer, recovered_margin, bundle_cost, cash_value
    ) values (
      new_offer, (item ->> 'margin_if_conceded')::numeric, (item ->> 'margin_offer')::numeric,
      (item ->> 'recovered_margin')::numeric, (item ->> 'bundle_cost')::numeric, (item ->> 'cash_value')::numeric
    );
  end loop;
end;
$$;

-- ส่งเรื่องให้เถ้าแก่ + หยุด AI (ห้ามเกิดแค่ครึ่งเดียว: AI หยุดแต่เถ้าแก่ไม่รู้ หรือรู้แต่ AI ยังตอบ)
create function public.escalate_chat(p_chat uuid, p_kind text, p_brief text[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.escalations (merchant_id, chat_id, kind, brief)
  select merchant_id, id, p_kind, p_brief from public.chats where id = p_chat;
  update public.chats set mode = 'human', updated_at = now() where id = p_chat;
end;
$$;

-- ออเดอร์ + หักสต๊อกของแถม · คืน null เมื่อการ์ดนี้เป็นออเดอร์ไปแล้ว หรือของแถมไม่พอ
create function public.place_order(
  p_chat uuid,
  p_buyer uuid,
  p_offer uuid,
  p_offer_message uuid,
  p_product_name text,
  p_gift_name text,
  p_gift_qty integer
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_merchant uuid;
  v_order uuid;
begin
  select merchant_id into v_merchant from public.chats where id = p_chat;

  insert into public.orders (merchant_id, chat_id, buyer_id, offer_id, offer_message_id, product_name)
  values (v_merchant, p_chat, p_buyer, p_offer, p_offer_message, p_product_name)
  on conflict do nothing
  returning id into v_order;
  if v_order is null then
    return null;
  end if;

  if p_gift_name is not null and coalesce(p_gift_qty, 0) > 0 then
    update public.dead_stock
       set qty_available = qty_available - p_gift_qty
     where merchant_id = v_merchant and name = p_gift_name and qty_available >= p_gift_qty;
    if not found then
      -- ของแถมไม่พอแล้ว: ยกเลิกออเดอร์นี้ทั้งก้อน
      raise exception 'gift_out_of_stock' using errcode = 'P0001';
    end if;
  end if;
  return v_order;
end;
$$;

-- ───────────────────────── 4) rate limit ─────────────────────────
create table app_private.rate_limits (
  key text not null,
  hit_at timestamptz not null default now()
);
create index rate_limits_key_idx on app_private.rate_limits (key, hit_at desc);

-- true = ยังไม่เกิน (และนับครั้งนี้) · false = เกินแล้ว ไม่นับเพิ่ม
create function public.hit_rate_limit(p_key text, p_window_seconds integer, p_max integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  recent integer;
begin
  -- ล็อกต่อ key กันคำขอพร้อมกันนับพลาด
  perform pg_advisory_xact_lock(hashtext(p_key));
  delete from app_private.rate_limits where key = p_key and hit_at < now() - make_interval(secs => p_window_seconds);
  select count(*) into recent from app_private.rate_limits where key = p_key;
  if recent >= p_max then
    return false;
  end if;
  insert into app_private.rate_limits (key) values (p_key);
  return true;
end;
$$;

-- ฟังก์ชันทั้งหมดเรียกได้จาก server (service role) เท่านั้น
revoke execute on function public.save_offers(uuid, uuid, text, jsonb) from public, anon, authenticated;
revoke execute on function public.escalate_chat(uuid, text, text[]) from public, anon, authenticated;
revoke execute on function public.place_order(uuid, uuid, uuid, uuid, text, text, integer) from public, anon, authenticated;
revoke execute on function public.hit_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.save_offers(uuid, uuid, text, jsonb) to service_role;
grant execute on function public.escalate_chat(uuid, text, text[]) to service_role;
grant execute on function public.place_order(uuid, uuid, uuid, uuid, text, text, integer) to service_role;
grant execute on function public.hit_rate_limit(text, integer, integer) to service_role;
