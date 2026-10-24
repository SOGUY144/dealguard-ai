// หน้าตั้งค่าสินค้า (เฟส 9) บน Supabase จริง: บันทึกแล้วข้อเสนอถัดไปเปลี่ยนตาม, ราคาต่ำกว่าพื้นโดนปฏิเสธ, สิทธิ์
// รัน: npm run test:db — แก้ราคาสินค้าจริงชั่วคราว แล้วคืนค่าจาก lib/config/merchant.json ตอนจบเสมอ
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import merchant from "@/lib/config/merchant.json";
import { handleAction, type PipelineDeps } from "@/lib/chat-server/pipeline";
import { SupabaseChatStore } from "@/lib/chat-server/supabase-store";
import type { ChatMessageOf } from "@/lib/chat/types";
import type { ProductSettingsForm } from "@/lib/owner/product-settings";
import { readProductSettings, saveProductSettings } from "@/lib/owner/products";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const publishable = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const storefront = {
  storeName: "ร้านเฮียชัยโมบาย",
  tagline: "ขายส่ง",
  ownerName: "เฮียชัย",
  assistantName: "ผู้ช่วย AI ของเฮียชัย",
  bankAccountName: "[ชื่อบัญชีร้าน]",
  contactChannel: "[ช่องทางติดต่อของร้าน]",
  orderRefPlaceholder: "[เลขออเดอร์]",
};
// สร้าง store ใหม่ทุกครั้ง = อ่านการตั้งค่าใหม่ (แบบเดียวกับทุก request ของเว็บ)
const deps = (): PipelineDeps => ({ store: new SupabaseChatStore(admin), storefront, intentLlm: null });

const seeded = merchant.products[0];
const ORIGINAL: ProductSettingsForm = {
  sku: seeded.sku,
  name: seeded.name,
  listPrice: seeded.listPrice,
  unitCost: seeded.unitCost,
  floorPrice: seeded.floorPrice,
  tiers: seeded.volumeTiers,
  cashDiscountPct: seeded.cashDiscountPct * 100,
  defaultCreditDays: seeded.defaultCreditDays,
  aiEnabled: true,
  costOfCapitalPct: merchant.costOfCapitalAnnual * 100,
  escalationDealValue: merchant.escalationDealValue,
  gifts: merchant.deadStock.map((d) => ({ sku: d.sku, enabled: true })),
};

const created: string[] = [];
async function makeUser(role: "buyer" | "owner", displayName: string) {
  const email = `prod-${randomBytes(4).toString("hex")}@dealguard.test`;
  const password = randomBytes(12).toString("base64url");
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: displayName, privacy_accepted: true },
  });
  if (error) throw error;
  created.push(data.user.id);
  if (role === "owner") await admin.from("profiles").update({ role: "owner" }).eq("id", data.user.id);
  const client = createClient(url, publishable, { auth: { persistSession: false, autoRefreshToken: false } });
  const signIn = await client.auth.signInWithPassword({ email, password });
  if (signIn.error) throw signIn.error;
  return { id: data.user.id, displayName, client };
}

let owner: Awaited<ReturnType<typeof makeUser>>;
let buyer: Awaited<ReturnType<typeof makeUser>>;

beforeAll(async () => {
  [owner, buyer] = await Promise.all([makeUser("owner", "เถ้าแก่ตั้งราคา"), makeUser("buyer", "คุณลองราคา")]);
});

afterAll(async () => {
  await saveProductSettings(admin, ORIGINAL);
  await Promise.all(created.map((id) => admin.auth.admin.deleteUser(id)));
});

async function offersFor(text: string) {
  await handleAction(deps(), buyer, { type: "pick_product", sku: seeded.sku });
  const view = await handleAction(deps(), buyer, { type: "send", text, inputMode: "text" });
  return view.messages.findLast((m): m is ChatMessageOf<"offers"> => m.type === "offers")!.offers;
}

describe("ตั้งค่าสินค้า (Owner-Settings)", () => {
  it("เถ้าแก่อ่านการตั้งค่าได้ครบ · ลูกค้าอ่านไม่ได้ (RLS)", async () => {
    const page = await readProductSettings(owner.client);
    expect(page.products).toEqual([ORIGINAL]);
    expect(page.gifts).toEqual([expect.objectContaining({ sku: "ADP-20W", name: "หัวชาร์จ 20W", enabled: true })]);
    expect(await readProductSettings(buyer.client)).toEqual({ products: [], gifts: [] });
  });

  it("ขึ้นราคาพื้นเป็น 130 → ข้อเสนอถัดไปไม่ต่ำกว่า 130", async () => {
    const result = await saveProductSettings(admin, {
      ...ORIGINAL,
      floorPrice: 130,
      tiers: [
        { minQty: 500, price: 140 },
        { minQty: 1500, price: 135 },
        { minQty: 3000, price: 130 },
      ],
    });
    expect(result).toEqual({ ok: true });
    const offers = await offersFor("ขอ 125 ได้ไหม 1000 ชิ้น");
    expect(offers.length).toBeGreaterThan(0);
    for (const o of offers) expect(o.pricePerUnit).toBeGreaterThanOrEqual(130);
    expect(offers.find((o) => o.lever === "volume")?.pricePerUnit).toBe(135);
  });

  it("ปิดของแถม → ไม่มีข้อเสนอรับของแถม", async () => {
    expect(await saveProductSettings(admin, { ...ORIGINAL, gifts: [{ sku: "ADP-20W", enabled: false }] })).toEqual({ ok: true });
    const offers = await offersFor("ขอ 125 ได้ไหม 1000 ชิ้น");
    expect(offers.some((o) => o.lever === "bundle")).toBe(false);
    expect(offers.some((o) => o.lever === "cash")).toBe(true);
  });

  it("ขั้นราคาต่ำกว่าพื้น → ไม่บันทึก ค่าเดิมไม่เปลี่ยน", async () => {
    await saveProductSettings(admin, ORIGINAL);
    const result = await saveProductSettings(admin, { ...ORIGINAL, tiers: [{ minQty: 3000, price: 110 }] });
    expect(result).toEqual({ ok: false, errors: { "tiers.0.price": "ต่ำกว่าราคาพื้น ฿120" } });
    expect((await readProductSettings(owner.client)).products[0].tiers).toEqual(ORIGINAL.tiers);
  });

  it("ฐานข้อมูลปฏิเสธขั้นราคาต่ำกว่าพื้นเองด้วย แม้ข้ามตัวตรวจในโค้ด", async () => {
    const { error } = await admin
      .from("products")
      .update({ volume_tiers: [{ minQty: 3000, price: 100 }] })
      .eq("sku", seeded.sku);
    expect(error?.message).toMatch(/products_tiers_within_range/);
  });

  it("เรียก RPC บันทึกตรงๆ ด้วยบัญชีเถ้าแก่ไม่ได้ (ต้องผ่าน server ที่เช็กสิทธิ์)", async () => {
    const { error } = await owner.client.rpc("save_product_settings", {
      p_sku: seeded.sku,
      p_name: seeded.name,
      p_list_price: 150,
      p_unit_cost: 100,
      p_floor_price: 100,
      p_tiers: [],
      p_cash_discount_pct: 0.5,
      p_default_credit_days: 30,
      p_ai_enabled: true,
      p_cost_of_capital_annual: 0.12,
      p_escalation_deal_value: 300000,
      p_gifts: [],
    });
    expect(error?.message).toMatch(/permission denied/);
  });
});
