// ใส่ข้อมูลร้าน/สินค้าจาก lib/config/merchant.json และสร้างบัญชีกรรมการ + เดโม (ยืนยันอีเมลแล้ว)
// รัน: npm run db:seed   (ต้องรัน npm run db:migrate ก่อน)
// รหัสผ่านสุ่มแล้วเก็บใน .demo-accounts.local.json / .md (git ไม่เก็บ) — รันซ้ำจะใช้รหัสเดิม ไม่เปลี่ยนรหัสที่แจกไปแล้ว
import { randomBytes } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import merchant from "../lib/config/merchant.json";

const ACCOUNTS = [
  { key: "owner", email: "owner@dealguard.test", displayName: "เฮียชัย", role: "owner", note: "เถ้าแก่ (ทีม)" },
  { key: "judge_owner", email: "judge.owner@dealguard.test", displayName: "กรรมการ (เถ้าแก่)", role: "owner", note: "ให้กรรมการดูหน้าเถ้าแก่" },
  { key: "judge_buyer", email: "judge.buyer@dealguard.test", displayName: "กรรมการ", role: "buyer", note: "ให้กรรมการลองต่อราคา" },
  { key: "demo_nok", email: "demo.nok@dealguard.test", displayName: "คุณนก", role: "buyer", note: "ลูกค้าเดโมบนเวที" },
] as const;

const JSON_FILE = ".demo-accounts.local.json";
const MD_FILE = ".demo-accounts.local.md";

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`ยังไม่ได้ตั้ง ${name} ใน .env.local`);
  return value;
}

async function readSavedPasswords(): Promise<Record<string, string>> {
  try {
    return JSON.parse(await readFile(JSON_FILE, "utf8"));
  } catch {
    return {};
  }
}

async function main() {
  const db = createClient(env("NEXT_PUBLIC_SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const check = <T>(label: string, res: { data: T; error: { message: string } | null }): NonNullable<T> => {
    if (res.error) throw new Error(`${label}: ${res.error.message}`);
    return res.data as NonNullable<T>;
  };

  // ── ร้าน (มีร้านเดียว) ──
  const shop = {
    name: merchant.merchantName,
    owner_display_name: merchant.ownerDisplayName,
    tagline: "ขายส่งอุปกรณ์มือถือ",
    cost_of_capital_annual: merchant.costOfCapitalAnnual,
    escalation_deal_value: merchant.escalationDealValue,
    bundle_concession_ratio: merchant.bundleConcessionRatio,
  };
  const existing = check("อ่านร้าน", await db.from("merchants").select("id").eq("name", shop.name).maybeSingle());
  const merchantId: string = existing
    ? (check("อัปเดตร้าน", await db.from("merchants").update(shop).eq("id", existing.id).select("id").single())).id
    : (check("สร้างร้าน", await db.from("merchants").insert(shop).select("id").single())).id;
  console.log(`✓ ร้าน ${shop.name}`);

  // ── สินค้า + ของค้างสต๊อก ──
  check(
    "สินค้า",
    await db.from("products").upsert(
      merchant.products.map((p) => ({
        merchant_id: merchantId,
        sku: p.sku,
        name: p.name,
        list_price: p.listPrice,
        unit_cost: p.unitCost,
        floor_price: p.floorPrice,
        volume_tiers: p.volumeTiers,
        cash_discount_pct: p.cashDiscountPct,
        default_credit_days: p.defaultCreditDays,
      })),
      { onConflict: "merchant_id,sku" },
    ),
  );
  check(
    "ของค้างสต๊อก",
    await db.from("dead_stock").upsert(
      merchant.deadStock.map((d) => ({
        merchant_id: merchantId,
        sku: d.sku,
        name: d.name,
        unit_cost: d.unitCost,
        perceived_value: d.perceivedValue,
        qty_available: d.qtyAvailable,
      })),
      { onConflict: "merchant_id,sku" },
    ),
  );
  console.log(`✓ สินค้า ${merchant.products.length} รายการ · ของค้างสต๊อก ${merchant.deadStock.length} รายการ`);

  // ── บัญชี ──
  const saved = await readSavedPasswords();
  const listed = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (listed.error) throw new Error(`อ่านผู้ใช้: ${listed.error.message}`);
  const users = listed.data.users;
  const passwords: Record<string, string> = {};

  for (const account of ACCOUNTS) {
    const password = saved[account.email] ?? randomBytes(12).toString("base64url");
    passwords[account.email] = password;
    const metadata = { display_name: account.displayName, privacy_accepted_at: new Date().toISOString() };
    const found = users.find((u) => u.email === account.email);

    const result = found
      ? await db.auth.admin.updateUserById(found.id, { password, email_confirm: true, user_metadata: metadata })
      : await db.auth.admin.createUser({ email: account.email, password, email_confirm: true, user_metadata: metadata });
    if (result.error) throw new Error(`${found ? "อัปเดต" : "สร้าง"} ${account.email}: ${result.error.message}`);
    const userId = result.data.user.id;

    // profile ถูกสร้างโดย trigger แล้ว — ตั้ง role และชื่อให้ตรง
    check(
      `ตั้ง role ${account.email}`,
      await db.from("profiles").update({ role: account.role, display_name: account.displayName }).eq("id", userId),
    );
    console.log(`✓ ${account.email} (${account.role}) ${found ? "มีอยู่แล้ว" : "สร้างใหม่"}`);
  }

  await writeFile(JSON_FILE, JSON.stringify(passwords, null, 2) + "\n");
  const rows = ACCOUNTS.map((a) => `| ${a.note} | ${a.role} | ${a.email} | \`${passwords[a.email]}\` |`);
  await writeFile(
    MD_FILE,
    [
      "# บัญชีเดโม / กรรมการ (ห้าม commit — ไฟล์นี้ถูก ignore ใน git)",
      "",
      "| ใช้ทำอะไร | role | อีเมล | รหัสผ่าน |",
      "|---|---|---|---|",
      ...rows,
      "",
      "อีเมล @dealguard.test เป็นโดเมนทดสอบ ส่งอีเมลจริงไม่ได้ — ใช้ล็อกอินอย่างเดียว",
      "",
    ].join("\n"),
  );
  console.log(`✓ เขียนรหัสผ่านไว้ที่ ${MD_FILE} (ไม่พิมพ์รหัสออกมาที่นี่)`);
}

main().catch((err) => {
  console.error(`seed ล้มเหลว: ${err instanceof Error ? err.message : err}`);
  process.exitCode = 1;
});
