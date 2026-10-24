-- รีวิวรอบ 3 (24 ต.ค. 2569)
-- 1) ยืนยันข้อเสนอเก่าที่มีของแถม หลังเถ้าแก่ปิด "ใช้เป็นของแถม" → ไม่หักสต๊อก ยกเลิกออเดอร์ (โค้ดเช็กก่อนแล้ว นี่คือด่านสอง)
-- 2) บันทึกการตั้งค่าสินค้า: ค่าระดับร้าน (ต้นทุนเงินทุน / เกณฑ์มูลค่าดีล) ส่ง null = ไม่เปลี่ยน
--    กันแท็บเก่าหรืออีกเครื่องที่แก้สินค้าอื่นเขียนทับค่าที่เพิ่งตั้ง (ของแถม: ส่งมาเฉพาะตัวที่กดเปลี่ยน)
-- create or replace = สิทธิ์เดิม (service role เท่านั้น) ยังอยู่

create or replace function public.place_order(
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
    -- ข้อเสนอเก่า (ก่อนมี sku ใน bundle) ยังหาด้วยชื่อได้ — แถวเดียวเท่านั้น · ของแถมที่ปิดใช้แล้วยืนยันไม่ได้
    update public.dead_stock
       set qty_available = qty_available - p_gift_qty
     where id = (
             select id from public.dead_stock
              where merchant_id = v_merchant
                and gift_enabled
                and (case when p_gift_sku is not null then sku = p_gift_sku else name = p_gift_name end)
              limit 1
           )
       and qty_available >= p_gift_qty;
    if not found then
      -- ของแถมไม่พอ / ปิดใช้แล้ว: ยกเลิกออเดอร์นี้ทั้งก้อน
      raise exception 'gift_out_of_stock' using errcode = 'P0001';
    end if;
  end if;
  return v_order;
end;
$$;

create or replace function public.save_product_settings(
  p_sku text,
  p_name text,
  p_list_price numeric,
  p_unit_cost numeric,
  p_floor_price numeric,
  p_tiers jsonb,
  p_cash_discount_pct numeric,
  p_default_credit_days integer,
  p_ai_enabled boolean,
  p_cost_of_capital_annual numeric,
  p_escalation_deal_value numeric,
  p_gifts jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_merchant uuid;
  v_gift jsonb;
begin
  select id into v_merchant from public.merchants order by created_at limit 1;

  update public.products
     set name = p_name,
         list_price = p_list_price,
         unit_cost = p_unit_cost,
         floor_price = p_floor_price,
         volume_tiers = p_tiers,
         cash_discount_pct = p_cash_discount_pct,
         default_credit_days = p_default_credit_days,
         ai_enabled = p_ai_enabled
   where merchant_id = v_merchant and sku = p_sku;
  if not found then
    raise exception 'product_not_found' using errcode = 'P0002';
  end if;

  -- null = เถ้าแก่ไม่ได้แก้ช่องนี้ (ใช้ค่าเดิมในฐานข้อมูล ไม่ใช่ค่าที่ค้างในหน้าจอ)
  update public.merchants
     set cost_of_capital_annual = coalesce(p_cost_of_capital_annual, cost_of_capital_annual),
         escalation_deal_value = coalesce(p_escalation_deal_value, escalation_deal_value)
   where id = v_merchant;

  for v_gift in select * from jsonb_array_elements(coalesce(p_gifts, '[]'::jsonb)) loop
    update public.dead_stock
       set gift_enabled = (v_gift ->> 'enabled')::boolean
     where merchant_id = v_merchant and sku = v_gift ->> 'sku';
  end loop;
end;
$$;
