-- เฟส 9: หน้าตั้งค่าสินค้า /owner/products (Owner-Settings)
-- 1) ของค้างสต๊อกเปิด/ปิดการใช้เป็นของแถมได้ (ข้อ C)
-- 2) ราคาตามจำนวนทุกขั้นต้องอยู่ระหว่างราคาพื้นกับราคาขาย — ฐานข้อมูลบังคับเอง ไม่พึ่งแค่โค้ด
-- 3) บันทึกสินค้า + ร้าน + ของแถมในคำสั่งเดียว (ผ่านหรือไม่ผ่านทั้งหมด) — เรียกได้เฉพาะ service role
--    server เช็กว่าเป็นเถ้าแก่ก่อนเรียกเสมอ (app/owner/products/actions.ts)

-- ───────────────────────── 1) ของแถมเปิด/ปิด ─────────────────────────
alter table public.dead_stock add column gift_enabled boolean not null default true;

-- ───────────────────────── 2) ราคาตามจำนวน ─────────────────────────
create function public.volume_tiers_valid(p_tiers jsonb, p_floor numeric, p_list numeric)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select jsonb_array_length(p_tiers) <= 10
     and coalesce(
           bool_and(
             jsonb_typeof(t) = 'object'
             and (t ->> 'minQty')::numeric >= 1
             and (t ->> 'minQty')::numeric = trunc((t ->> 'minQty')::numeric)
             and (t ->> 'price')::numeric between p_floor and p_list
           ),
           true
         )
    from jsonb_array_elements(p_tiers) as t
$$;

alter table public.products
  add constraint products_tiers_within_range check (public.volume_tiers_valid(volume_tiers, floor_price, list_price));

-- ───────────────────────── 3) บันทึกการตั้งค่า ─────────────────────────
create function public.save_product_settings(
  p_sku text,
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
  -- MVP มีร้านเดียว
  select id into v_merchant from public.merchants order by created_at limit 1;

  update public.products
     set list_price = p_list_price,
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

  update public.merchants
     set cost_of_capital_annual = p_cost_of_capital_annual,
         escalation_deal_value = p_escalation_deal_value
   where id = v_merchant;

  for v_gift in select * from jsonb_array_elements(coalesce(p_gifts, '[]'::jsonb)) loop
    update public.dead_stock
       set gift_enabled = (v_gift ->> 'enabled')::boolean
     where merchant_id = v_merchant and sku = v_gift ->> 'sku';
  end loop;
end;
$$;

revoke execute on function public.save_product_settings(text, numeric, numeric, numeric, jsonb, numeric, integer, boolean, numeric, numeric, jsonb)
  from public, anon, authenticated;
grant execute on function public.save_product_settings(text, numeric, numeric, numeric, jsonb, numeric, integer, boolean, numeric, numeric, jsonb)
  to service_role;
