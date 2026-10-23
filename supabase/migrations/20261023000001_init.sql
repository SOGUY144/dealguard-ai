-- DealGuard AI — schema เริ่มต้น (เฟส 3)
-- หลักการ:
--   * เปิด RLS ทุกตาราง · ผู้ใช้ที่ล็อกอิน (authenticated) อ่านได้ตาม policy เท่านั้น เขียนตรงไม่ได้เลย
--   * การเขียนทั้งหมดทำจาก server ด้วย service_role (Deal Engine / API) ซึ่งข้าม RLS
--   * ตัวเลขหลังบ้าน (ต้นทุน, ราคาพื้น, margin) อยู่ในตารางที่เฉพาะ owner อ่านได้
--   * โปรเจกต์ปิด "Automatically expose new tables" ไว้ จึงต้อง GRANT เองทุกตาราง

-- ───────────────────────── ประเภท ─────────────────────────
create type public.app_role as enum ('owner', 'buyer');

-- ───────────────────────── ร้าน (มีร้านเดียวใน MVP) ─────────────────────────
create table public.merchants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_display_name text not null,
  tagline text not null default '',
  cost_of_capital_annual numeric(6, 4) not null check (cost_of_capital_annual >= 0),
  escalation_deal_value numeric(14, 2) not null check (escalation_deal_value > 0),
  bundle_concession_ratio numeric(4, 3) not null default 0.2 check (bundle_concession_ratio between 0 and 1),
  -- placeholder จากดีไซน์ ต้องให้ทีมใส่ข้อมูลจริง
  bank_account_name text not null default '[ชื่อบัญชีร้าน]',
  contact_channel text not null default '[ช่องทางติดต่อของร้าน]',
  created_at timestamptz not null default now()
);

-- ───────────────────────── บัญชีผู้ใช้ ─────────────────────────
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.app_role not null default 'buyer',
  display_name text not null check (char_length(display_name) between 1 and 80),
  privacy_accepted_at timestamptz,
  created_at timestamptz not null default now()
);

-- ───────────────────────── สินค้า (หลังบ้าน) ─────────────────────────
create table public.products (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants (id) on delete cascade,
  sku text not null,
  name text not null,
  list_price numeric(12, 2) not null check (list_price > 0),
  unit_cost numeric(12, 2) not null check (unit_cost >= 0),
  floor_price numeric(12, 2) not null check (floor_price >= unit_cost and floor_price <= list_price),
  volume_tiers jsonb not null default '[]'::jsonb check (jsonb_typeof(volume_tiers) = 'array'),
  cash_discount_pct numeric(5, 4) not null default 0 check (cash_discount_pct between 0 and 1),
  default_credit_days integer not null default 30 check (default_credit_days >= 0),
  ai_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  unique (merchant_id, sku)
);

create table public.dead_stock (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants (id) on delete cascade,
  sku text not null,
  name text not null,
  unit_cost numeric(12, 2) not null check (unit_cost >= 0),
  perceived_value numeric(12, 2) not null check (perceived_value >= 0),
  qty_available integer not null check (qty_available >= 0),
  created_at timestamptz not null default now(),
  unique (merchant_id, sku)
);

-- ───────────────────────── แชต ─────────────────────────
create table public.chats (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants (id) on delete cascade,
  buyer_id uuid not null references public.profiles (id) on delete cascade,
  mode text not null default 'ai' check (mode in ('ai', 'human')),
  below_floor_count integer not null default 0 check (below_floor_count >= 0),
  injection_count integer not null default 0 check (injection_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index chats_buyer_idx on public.chats (buyer_id, created_at desc);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.chats (id) on delete cascade,
  -- ตรงกับ ChatMessage["type"] ใน lib/chat/types.ts (+ owner_text ของเฟส 8)
  type text not null check (
    type in ('ai_text', 'ai_voice', 'buyer_text', 'owner_text', 'product_card', 'offers', 'order_summary', 'handoff', 'system')
  ),
  input_mode text check (input_mode in ('text', 'voice')),
  body jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index messages_chat_idx on public.messages (chat_id, created_at);

-- ───────────────────────── ข้อเสนอ ─────────────────────────
-- ส่วนที่ลูกค้าเห็นได้ (ตรงกับ Offer ใน HANDOFF §5) — ยืนยันออเดอร์ด้วย id จากตารางนี้ ไม่รับตัวเลขจาก browser
create table public.offers (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.chats (id) on delete cascade,
  message_id uuid references public.messages (id) on delete cascade,
  letter text not null check (letter in ('A', 'B', 'C')),
  lever text not null check (lever in ('volume', 'cash', 'bundle', 'list')),
  sku text not null,
  label text not null,
  price_per_unit numeric(12, 2) not null check (price_per_unit > 0),
  qty integer not null check (qty > 0),
  condition_text text not null,
  total numeric(14, 2) not null check (total > 0),
  credit_days integer not null check (credit_days >= 0),
  bundle jsonb,
  created_at timestamptz not null default now()
);
create index offers_chat_idx on public.offers (chat_id);

-- margin ของแต่ละข้อเสนอ — owner เท่านั้น (SKILL §6.4 ข้อ 4)
create table public.offer_economics (
  offer_id uuid primary key references public.offers (id) on delete cascade,
  margin_if_conceded numeric(14, 2) not null,
  margin_offer numeric(14, 2) not null,
  recovered_margin numeric(14, 2) not null,
  bundle_cost numeric(14, 2) not null default 0,
  cash_value numeric(14, 2) not null default 0
);

-- ───────────────────────── ออเดอร์ ─────────────────────────
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants (id) on delete cascade,
  chat_id uuid not null references public.chats (id) on delete cascade,
  buyer_id uuid not null references public.profiles (id) on delete cascade,
  offer_id uuid not null unique references public.offers (id),
  product_name text not null,
  created_at timestamptz not null default now()
);
create index orders_merchant_idx on public.orders (merchant_id, created_at desc);

-- ───────────────────────── เรื่องที่ส่งให้เถ้าแก่ ─────────────────────────
create table public.escalations (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants (id) on delete cascade,
  chat_id uuid not null references public.chats (id) on delete cascade,
  kind text not null check (
    kind in ('over_value', 'refund', 'complaint', 'below_floor_3x', 'injection', 'buyer_request')
  ),
  brief text[] not null check (array_length(brief, 1) = 3),
  status text not null default 'open' check (status in ('open', 'resolved')),
  created_at timestamptz not null default now()
);
create index escalations_merchant_idx on public.escalations (merchant_id, status, created_at desc);

-- ───────────────────────── สร้าง profile อัตโนมัติตอนสมัคร ─────────────────────────
-- role เริ่มต้นเป็น buyer เสมอ — owner ตั้งด้วย SQL/seed เท่านั้น ผู้ใช้แก้ role เองไม่ได้
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, privacy_accepted_at)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), split_part(new.email, '@', 1)),
    (new.raw_user_meta_data ->> 'privacy_accepted_at')::timestamptz
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ───────────────────────── helper สำหรับ policy ─────────────────────────
-- security definer: อ่าน profiles ได้โดยไม่วนเข้า policy ของ profiles เอง
create function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles where id = (select auth.uid()) and role = 'owner'
  );
$$;

create function public.owns_chat(target_chat uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.chats where id = target_chat and buyer_id = (select auth.uid())
  );
$$;

revoke execute on function public.is_owner() from public, anon;
revoke execute on function public.owns_chat(uuid) from public, anon;
grant execute on function public.is_owner() to authenticated;
grant execute on function public.owns_chat(uuid) to authenticated;

-- ───────────────────────── RLS ─────────────────────────
alter table public.merchants enable row level security;
alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.dead_stock enable row level security;
alter table public.chats enable row level security;
alter table public.messages enable row level security;
alter table public.offers enable row level security;
alter table public.offer_economics enable row level security;
alter table public.orders enable row level security;
alter table public.escalations enable row level security;

-- อ่านได้เฉพาะ owner: ข้อมูลร้าน, ต้นทุน/ราคาพื้น, margin, เรื่องที่ส่งต่อ
create policy "owner reads merchants" on public.merchants for select to authenticated using (public.is_owner());
create policy "owner reads products" on public.products for select to authenticated using (public.is_owner());
create policy "owner reads dead stock" on public.dead_stock for select to authenticated using (public.is_owner());
create policy "owner reads offer economics" on public.offer_economics for select to authenticated using (public.is_owner());
create policy "owner reads escalations" on public.escalations for select to authenticated using (public.is_owner());

-- ของตัวเอง หรือ owner
create policy "read own profile" on public.profiles for select to authenticated
  using (id = (select auth.uid()) or public.is_owner());
create policy "read own chats" on public.chats for select to authenticated
  using (buyer_id = (select auth.uid()) or public.is_owner());
create policy "read own messages" on public.messages for select to authenticated
  using (public.owns_chat(chat_id) or public.is_owner());
create policy "read own offers" on public.offers for select to authenticated
  using (public.owns_chat(chat_id) or public.is_owner());
create policy "read own orders" on public.orders for select to authenticated
  using (buyer_id = (select auth.uid()) or public.is_owner());

-- ───────────────────────── GRANT ─────────────────────────
-- anon (ยังไม่ล็อกอิน) ไม่ได้อะไรเลย · authenticated อ่านอย่างเดียว (ผ่าน RLS) · service_role ทำได้ทุกอย่าง
grant usage on schema public to authenticated, service_role;
grant select on
  public.merchants, public.profiles, public.products, public.dead_stock, public.chats,
  public.messages, public.offers, public.offer_economics, public.orders, public.escalations
  to authenticated;
grant all on
  public.merchants, public.profiles, public.products, public.dead_stock, public.chats,
  public.messages, public.offers, public.offer_economics, public.orders, public.escalations
  to service_role;

-- ───────────────────────── Realtime (เฟส 7–8) ─────────────────────────
-- postgres_changes เคารพ RLS: ลูกค้าได้ยินแค่แชตของตัวเอง, owner ได้ยินทั้งหมด
alter publication supabase_realtime add table public.messages, public.chats, public.orders, public.escalations;
