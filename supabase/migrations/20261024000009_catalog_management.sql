-- ทำให้หน้าสินค้าของเถ้าแก่ใช้ได้จริงทั้งหมด (24 ต.ค. 2569)
-- 1) รูปสินค้า / ของแถม — เก็บใน Supabase Storage (bucket สาธารณะ อ่านได้ทุกคน เขียนได้เฉพาะ service role)
-- 2) บันทึกการตั้งค่าแก้ชื่อสินค้าได้ด้วย
-- 3) นำเข้าสินค้าจาก Excel/CSV ทีละหลายแถวในคำสั่งเดียว (ผ่านหรือไม่ผ่านทั้งหมด)
-- ทุก RPC เรียกได้เฉพาะ service role — server เช็กว่าเป็นเถ้าแก่ก่อนเรียกเสมอ (app/owner/products/actions.ts)

-- ───────────────────────── 1) รูป ─────────────────────────
alter table public.products add column image_path text;
alter table public.dead_stock add column image_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 1048576, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
-- ไม่มี policy บน storage.objects สำหรับ anon/authenticated = อัปโหลด/ลบได้เฉพาะ service role

-- รหัสสินค้า (sku) ห้ามซ้ำกันระหว่างสินค้าขายกับของแถม — ข้อ C หักสต๊อกของแถมด้วย sku
create function public.sku_in_use(p_merchant uuid, p_sku text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (select 1 from public.products where merchant_id = p_merchant and sku = p_sku)
      or exists (select 1 from public.dead_stock where merchant_id = p_merchant and sku = p_sku)
$$;
revoke execute on function public.sku_in_use(uuid, text) from public, anon, authenticated;
grant execute on function public.sku_in_use(uuid, text) to service_role;

-- ───────────────────────── 2) บันทึกการตั้งค่า + ชื่อ ─────────────────────────
-- ตัวเดิม (ไม่มี p_name) ยังเก็บไว้ — เว็บที่ deploy อยู่ใช้จนกว่าโค้ดใหม่ขึ้น · ลบใน migration ถัดไป
create function public.save_product_settings(
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

revoke execute on function public.save_product_settings(text, text, numeric, numeric, numeric, jsonb, numeric, integer, boolean, numeric, numeric, jsonb)
  from public, anon, authenticated;
grant execute on function public.save_product_settings(text, text, numeric, numeric, numeric, jsonb, numeric, integer, boolean, numeric, numeric, jsonb)
  to service_role;

-- ───────────────────────── 3) นำเข้าหลายแถว ─────────────────────────
-- แถวละ {sku, name, listPrice, unitCost, floorPrice, cashDiscountPct (สัดส่วน), defaultCreditDays}
-- sku ใหม่ = เพิ่มสินค้า (ยังไม่มีขั้นราคา) · sku เดิม = แก้ราคา ขั้นราคาเดิมยังอยู่ (check constraint ตรวจว่ายังไม่ต่ำกว่าพื้น)
create function public.import_products(p_rows jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_merchant uuid;
  v_row jsonb;
  v_count integer := 0;
begin
  select id into v_merchant from public.merchants order by created_at limit 1;
  for v_row in select * from jsonb_array_elements(p_rows) loop
    if exists (select 1 from public.dead_stock where merchant_id = v_merchant and sku = v_row ->> 'sku') then
      raise exception 'sku_is_gift:%', v_row ->> 'sku' using errcode = 'P0001';
    end if;
    insert into public.products (merchant_id, sku, name, list_price, unit_cost, floor_price, cash_discount_pct, default_credit_days)
    values (
      v_merchant,
      v_row ->> 'sku',
      v_row ->> 'name',
      (v_row ->> 'listPrice')::numeric,
      (v_row ->> 'unitCost')::numeric,
      (v_row ->> 'floorPrice')::numeric,
      (v_row ->> 'cashDiscountPct')::numeric,
      (v_row ->> 'defaultCreditDays')::integer
    )
    on conflict (merchant_id, sku) do update
       set name = excluded.name,
           list_price = excluded.list_price,
           unit_cost = excluded.unit_cost,
           floor_price = excluded.floor_price,
           cash_discount_pct = excluded.cash_discount_pct,
           default_credit_days = excluded.default_credit_days;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

revoke execute on function public.import_products(jsonb) from public, anon, authenticated;
grant execute on function public.import_products(jsonb) to service_role;
