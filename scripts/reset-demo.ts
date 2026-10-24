// ล้างข้อมูลเดโมก่อนขึ้นเวที: แชตทั้งหมด (ข้อความ/ข้อเสนอ/ออเดอร์/เรื่องที่ส่งต่อหายตามกัน) + ตัวนับ rate limit
// แล้วคืนร้านให้ตรงกับ lib/config/merchant.json ทั้งหมด: สินค้า/ของแถมที่เพิ่มหรือนำเข้าทีหลังถูกลบ, ที่ถูกลบกลับมา,
// ชื่อ/ราคา/สต๊อกกลับเป็นค่าเดิม, รูปที่อัปโหลดถูกลบ (เถ้าแก่หรือกรรมการอาจแก้ในหน้าสินค้า) · บัญชีและรหัสผ่านไม่ถูกแตะ
// รัน: npm run demo:reset          → ดูว่าจะลบ/คืนอะไรบ้าง (ยังไม่ลบ)
//      npm run demo:reset -- --yes  → ลบจริง (ฐานข้อมูลเดียวกับเว็บบน Vercel)
// เป็นสคริปต์ ไม่ใช่ปุ่มในหน้าเถ้าแก่ เพราะกรรมการมีบัญชี owner ด้วย กดเล่นแล้วข้อมูลกลางเดโมจะหาย
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";
import merchant from "../lib/config/merchant.json";

const BUCKET = "product-images";

async function listImages(): Promise<string[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return [];
  const storage = createClient(url, key, { auth: { persistSession: false } }).storage.from(BUCKET);
  const paths: string[] = [];
  for (const folder of ["product", "gift"]) {
    const { data, error } = await storage.list(folder, { limit: 1000 });
    if (error) throw new Error(`อ่านรูปใน ${folder}/: ${error.message}`);
    paths.push(...(data ?? []).map((f) => `${folder}/${f.name}`));
  }
  return paths;
}

async function removeImages(paths: string[]) {
  if (paths.length === 0) return;
  const storage = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  }).storage.from(BUCKET);
  const { error } = await storage.remove(paths);
  if (error) throw new Error(`ลบรูป: ${error.message}`);
}

async function main() {
  const url = process.env.SUPABASE_DB_URL;
  if (!url) {
    console.log("ยังไม่ได้ตั้ง SUPABASE_DB_URL ใน .env.local (Supabase > Connect > Session pooler)");
    process.exitCode = 1;
    return;
  }
  const confirmed = process.argv.includes("--yes");
  const seedProducts = merchant.products.map((p) => p.sku);
  const seedGifts = merchant.deadStock.map((d) => d.sku);
  const sql = postgres(url, { max: 1, onnotice: () => {} });
  try {
    const [counts] = await sql<{ chats: number; messages: number; orders: number; escalations: number }[]>`
      select (select count(*)::int from public.chats) as chats,
             (select count(*)::int from public.messages) as messages,
             (select count(*)::int from public.orders) as orders,
             (select count(*)::int from public.escalations) as escalations`;
    const extraProducts = await sql<{ sku: string }[]>`select sku from public.products where sku <> all(${seedProducts})`;
    const extraGifts = await sql<{ sku: string }[]>`select sku from public.dead_stock where sku <> all(${seedGifts})`;
    const images = await listImages();
    console.log(
      `แชต ${counts.chats} · ข้อความ ${counts.messages} · ออเดอร์ ${counts.orders} · เรื่องที่ส่งต่อ ${counts.escalations}`,
    );
    console.log(
      `สินค้าที่เพิ่มทีหลัง ${extraProducts.length} (${extraProducts.map((r) => r.sku).join(", ") || "-"}) · ของแถมที่เพิ่มทีหลัง ${extraGifts.length} · รูป ${images.length}`,
    );
    if (!confirmed) {
      console.log("ยังไม่ได้ลบ — รัน npm run demo:reset -- --yes เพื่อลบจริง");
      return;
    }

    await sql.begin(async (tx) => {
      const [shop] = await tx<{ id: string }[]>`select id from public.merchants order by created_at limit 1`;
      // orders.offer_id ไม่มี cascade — ลบออเดอร์ก่อน แล้วที่เหลือหายตามแชต
      await tx`delete from public.orders`;
      await tx`delete from public.chats`;
      await tx`delete from app_private.rate_limits`;

      await tx`delete from public.products where sku <> all(${seedProducts})`;
      await tx`delete from public.dead_stock where sku <> all(${seedGifts})`;
      for (const p of merchant.products) {
        await tx`
          insert into public.products (merchant_id, sku, name, list_price, unit_cost, floor_price, volume_tiers,
                                       cash_discount_pct, default_credit_days, ai_enabled, image_path)
          values (${shop.id}, ${p.sku}, ${p.name}, ${p.listPrice}, ${p.unitCost}, ${p.floorPrice}, ${tx.json(p.volumeTiers)},
                  ${p.cashDiscountPct}, ${p.defaultCreditDays}, true, null)
          on conflict (merchant_id, sku) do update
             set name = excluded.name, list_price = excluded.list_price, unit_cost = excluded.unit_cost,
                 floor_price = excluded.floor_price, volume_tiers = excluded.volume_tiers,
                 cash_discount_pct = excluded.cash_discount_pct, default_credit_days = excluded.default_credit_days,
                 ai_enabled = true, image_path = null`;
      }
      for (const d of merchant.deadStock) {
        await tx`
          insert into public.dead_stock (merchant_id, sku, name, unit_cost, perceived_value, qty_available, gift_enabled, image_path)
          values (${shop.id}, ${d.sku}, ${d.name}, ${d.unitCost}, ${d.perceivedValue}, ${d.qtyAvailable}, true, null)
          on conflict (merchant_id, sku) do update
             set name = excluded.name, unit_cost = excluded.unit_cost, perceived_value = excluded.perceived_value,
                 qty_available = excluded.qty_available, gift_enabled = true, image_path = null`;
      }
      await tx`
        update public.merchants
           set cost_of_capital_annual = ${merchant.costOfCapitalAnnual},
               escalation_deal_value = ${merchant.escalationDealValue},
               bundle_concession_ratio = ${merchant.bundleConcessionRatio}
         where id = ${shop.id}`;

      // ตรวจว่าคืนครบจริง — ไม่ครบให้ยกเลิกทั้งหมด (ดีกว่าบอกว่าสำเร็จแต่ร้านยังเพี้ยน)
      const [after] = await tx<{ products: number; gifts: number }[]>`
        select (select count(*)::int from public.products) as products, (select count(*)::int from public.dead_stock) as gifts`;
      if (after.products !== seedProducts.length || after.gifts !== seedGifts.length) {
        throw new Error(`คืนไม่ครบ: สินค้า ${after.products}/${seedProducts.length} ของแถม ${after.gifts}/${seedGifts.length}`);
      }
    });
    // รูปลบหลังฐานข้อมูลสำเร็จ (ฐานข้อมูลไม่ชี้ไปรูปไหนแล้ว)
    await removeImages(images);
    console.log(
      `✓ ล้างแล้ว · ร้านกลับเป็นตาม merchant.json (สินค้า ${seedProducts.length} · ของแถม ${seedGifts.length}) · ลบรูป ${images.length}`,
    );
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error(`ล้างข้อมูลเดโมล้มเหลว: ${err instanceof Error ? err.message : err}`);
  process.exitCode = 1;
});
