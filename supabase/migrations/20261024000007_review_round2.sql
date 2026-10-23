-- แก้จากการรีวิวรอบ 2 (24 ต.ค. 2569)
-- 1) หักสต๊อกของแถมด้วย sku (unique ต่อร้าน) — เดิมใช้ชื่อ: เถ้าแก่เปลี่ยนชื่อแล้วสั่งข้อ C ไม่ได้ / ชื่อซ้ำหักสองแถว
-- 2) rate limit แบบ "ดูอย่างเดียว" + "นับเฉพาะตอนพลาด" — กันคนอื่นล็อกบัญชีเถ้าแก่ด้วยการใส่รหัสผิด
-- 3) ลบแถวนับครั้งที่เก่าเกิน 1 วันของทุก key (เดิมลบเฉพาะ key ที่ถูกเรียก → ตารางโตไม่หยุด)

-- ───────────────────────── 1) place_order หักของแถมด้วย sku ─────────────────────────
drop function public.place_order(uuid, uuid, uuid, uuid, text, text, integer);

create function public.place_order(
  p_chat uuid,
  p_buyer uuid,
  p_offer uuid,
  p_offer_message uuid,
  p_product_name text,
  p_gift_sku text,
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

  if coalesce(p_gift_qty, 0) > 0 then
    -- ข้อเสนอเก่า (ก่อนมี sku ใน bundle) ยังหาด้วยชื่อได้ — แถวเดียวเท่านั้น
    update public.dead_stock
       set qty_available = qty_available - p_gift_qty
     where id = (
             select id from public.dead_stock
              where merchant_id = v_merchant
                and (case when p_gift_sku is not null then sku = p_gift_sku else name = p_gift_name end)
              limit 1
           )
       and qty_available >= p_gift_qty;
    if not found then
      -- ของแถมไม่พอแล้ว: ยกเลิกออเดอร์นี้ทั้งก้อน
      raise exception 'gift_out_of_stock' using errcode = 'P0001';
    end if;
  end if;
  return v_order;
end;
$$;

-- ───────────────────────── 2) rate limit: ดูอย่างเดียว / นับเพิ่ม ─────────────────────────
-- true = ยังไม่เกิน (ไม่นับครั้งนี้)
create function public.check_rate_limit(p_key text, p_window_seconds integer, p_max integer)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select count(*) < p_max
    from app_private.rate_limits
   where key = p_key and hit_at >= now() - make_interval(secs => p_window_seconds);
$$;

-- นับเพิ่ม 1 ครั้ง (ใช้กับการล็อกอินที่ผิด)
create function public.record_rate_hit(p_key text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into app_private.rate_limits (key) values (p_key);
  -- เก็บกวาดของทุก key เป็นครั้งคราว (ช่วงที่ยาวที่สุดที่ใช้คือ 1 ชั่วโมง)
  if random() < 0.02 then
    delete from app_private.rate_limits where hit_at < now() - interval '1 day';
  end if;
end;
$$;

-- ───────────────────────── 3) hit_rate_limit เก็บกวาดของทุก key ด้วย ─────────────────────────
create or replace function public.hit_rate_limit(p_key text, p_window_seconds integer, p_max integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  recent integer;
begin
  perform pg_advisory_xact_lock(hashtext(p_key));
  delete from app_private.rate_limits where key = p_key and hit_at < now() - make_interval(secs => p_window_seconds);
  if random() < 0.02 then
    delete from app_private.rate_limits where hit_at < now() - interval '1 day';
  end if;
  select count(*) into recent from app_private.rate_limits where key = p_key;
  if recent >= p_max then
    return false;
  end if;
  insert into app_private.rate_limits (key) values (p_key);
  return true;
end;
$$;

revoke execute on function public.place_order(uuid, uuid, uuid, uuid, text, text, text, integer) from public, anon, authenticated;
revoke execute on function public.check_rate_limit(text, integer, integer) from public, anon, authenticated;
revoke execute on function public.record_rate_hit(text) from public, anon, authenticated;
grant execute on function public.place_order(uuid, uuid, uuid, uuid, text, text, text, integer) to service_role;
grant execute on function public.check_rate_limit(text, integer, integer) to service_role;
grant execute on function public.record_rate_hit(text) to service_role;
