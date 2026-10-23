// รัน SQL ใน supabase/migrations/ ที่ยังไม่เคยรัน ตามลำดับชื่อไฟล์ (ไฟล์ละ 1 transaction)
// รัน: npm run db:migrate   — ต้องมี SUPABASE_DB_URL (Session pooler connection string) ใน .env.local
import { readdir, readFile } from "node:fs/promises";
import postgres from "postgres";

const DIR = "supabase/migrations";

async function main() {
  const url = process.env.SUPABASE_DB_URL;
  if (!url) {
    console.log("ยังไม่ได้ตั้ง SUPABASE_DB_URL ใน .env.local (Supabase > Connect > Session pooler)");
    process.exitCode = 1;
    return;
  }
  const sql = postgres(url, { max: 1, onnotice: () => {} });
  try {
    await sql`create schema if not exists app_private`;
    await sql`create table if not exists app_private.migrations (name text primary key, applied_at timestamptz not null default now())`;
    const applied = new Set((await sql<{ name: string }[]>`select name from app_private.migrations`).map((r) => r.name));

    const files = (await readdir(DIR)).filter((f) => f.endsWith(".sql")).sort();
    const pending = files.filter((f) => !applied.has(f));
    if (pending.length === 0) {
      console.log(`ไม่มี migration ใหม่ (รันแล้ว ${applied.size} ไฟล์)`);
      return;
    }
    for (const file of pending) {
      const body = await readFile(`${DIR}/${file}`, "utf8");
      await sql.begin(async (tx) => {
        await tx.unsafe(body);
        await tx`insert into app_private.migrations (name) values (${file})`;
      });
      console.log(`✓ ${file}`);
    }
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error(`migration ล้มเหลว: ${err instanceof Error ? err.message : err}`);
  process.exitCode = 1;
});
