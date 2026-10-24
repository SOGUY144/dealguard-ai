// ล้างข้อมูลเดโมก่อนขึ้นเวที: แชตทั้งหมด (ข้อความ/ข้อเสนอ/ออเดอร์/เรื่องที่ส่งต่อหายตามกัน) + ตัวนับ rate limit
// แล้วคืนของแถมในสต๊อกตาม lib/config/merchant.json · บัญชี สินค้า และรหัสผ่านไม่ถูกแตะ
// รัน: npm run demo:reset          → ดูว่าจะลบอะไรบ้าง (ยังไม่ลบ)
//      npm run demo:reset -- --yes  → ลบจริง (ฐานข้อมูลเดียวกับเว็บบน Vercel)
// เป็นสคริปต์ ไม่ใช่ปุ่มในหน้าเถ้าแก่ เพราะกรรมการมีบัญชี owner ด้วย กดเล่นแล้วข้อมูลกลางเดโมจะหาย
import postgres from "postgres";
import merchant from "../lib/config/merchant.json";

async function main() {
  const url = process.env.SUPABASE_DB_URL;
  if (!url) {
    console.log("ยังไม่ได้ตั้ง SUPABASE_DB_URL ใน .env.local (Supabase > Connect > Session pooler)");
    process.exitCode = 1;
    return;
  }
  const confirmed = process.argv.includes("--yes");
  const sql = postgres(url, { max: 1, onnotice: () => {} });
  try {
    const [counts] = await sql<{ chats: number; messages: number; orders: number; escalations: number }[]>`
      select (select count(*)::int from public.chats) as chats,
             (select count(*)::int from public.messages) as messages,
             (select count(*)::int from public.orders) as orders,
             (select count(*)::int from public.escalations) as escalations`;
    console.log(
      `แชต ${counts.chats} · ข้อความ ${counts.messages} · ออเดอร์ ${counts.orders} · เรื่องที่ส่งต่อ ${counts.escalations}`,
    );
    if (!confirmed) {
      console.log("ยังไม่ได้ลบ — รัน npm run demo:reset -- --yes เพื่อลบจริง");
      return;
    }

    await sql.begin(async (tx) => {
      // orders.offer_id ไม่มี cascade — ลบออเดอร์ก่อน แล้วที่เหลือหายตามแชต
      await tx`delete from public.orders`;
      await tx`delete from public.chats`;
      await tx`delete from app_private.rate_limits`;
      for (const d of merchant.deadStock) {
        await tx`update public.dead_stock set qty_available = ${d.qtyAvailable} where sku = ${d.sku}`;
      }
    });
    console.log(`✓ ล้างแล้ว · คืนของแถม ${merchant.deadStock.map((d) => `${d.name} ${d.qtyAvailable}`).join(", ")}`);
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error(`ล้างข้อมูลเดโมล้มเหลว: ${err instanceof Error ? err.message : err}`);
  process.exitCode = 1;
});
