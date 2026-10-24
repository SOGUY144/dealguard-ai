// เพิ่ม/ลบสินค้า, ของแถม, รูป, นำเข้า บน Supabase จริง — ใช้รหัสขึ้นต้น T- แล้วลบทิ้งตอนจบเสมอ
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { afterAll, describe, expect, it } from "vitest";
import { toPublicProducts } from "@/lib/chat-server/pipeline";
import { SupabaseChatStore } from "@/lib/chat-server/supabase-store";
import { createProduct, deleteItem, importProducts, removeImage, saveGift, setImage } from "@/lib/owner/catalog";
import { readProductSettings } from "@/lib/owner/products";

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const tag = randomBytes(3).toString("hex").toUpperCase();
const sku = (n: string) => `T-${tag}-${n}`;
const product = (n: string, patch = {}) => ({
  sku: sku(n),
  name: `สินค้าทดสอบ ${n}`,
  listPrice: 200,
  unitCost: 100,
  floorPrice: 150,
  cashDiscountPct: 5,
  defaultCreditDays: 30,
  ...patch,
});
// PNG 1×1 จริง
const PNG = Uint8Array.from(
  atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg=="),
  (c) => c.charCodeAt(0),
);

afterAll(async () => {
  await admin.from("products").delete().like("sku", `T-${tag}-%`);
  await admin.from("dead_stock").delete().like("sku", `T-${tag}-%`);
  const listed = await admin.storage.from("product-images").list("product", { search: `T-${tag}` });
  const giftListed = await admin.storage.from("product-images").list("gift", { search: `T-${tag}` });
  const leftovers = [
    ...(listed.data ?? []).map((f) => `product/${f.name}`),
    ...(giftListed.data ?? []).map((f) => `gift/${f.name}`),
  ];
  if (leftovers.length) await admin.storage.from("product-images").remove(leftovers);
});

describe("เพิ่ม/ลบสินค้า", () => {
  it("เพิ่มแล้วลูกค้าเห็นในรายการสินค้า และ AI ต่อราคาได้ · ลบแล้วหายไป", async () => {
    expect(await createProduct(admin, product("A"))).toEqual({ ok: true });
    const config = await new SupabaseChatStore(admin).loadConfig();
    expect(toPublicProducts(config)).toContainEqual({ sku: sku("A"), name: "สินค้าทดสอบ A", listPrice: 200 });
    expect(config.products.find((p) => p.sku === sku("A"))).toMatchObject({ floorPrice: 150, cashDiscountPct: 0.05, volumeTiers: [] });

    await deleteItem(admin, "product", sku("A"));
    const after = await new SupabaseChatStore(admin).loadConfig();
    expect(after.products.some((p) => p.sku === sku("A"))).toBe(false);
  });

  it("รหัสซ้ำ (กับสินค้าหรือของแถม) / ราคาพื้นต่ำกว่าทุน → ไม่บันทึก", async () => {
    await createProduct(admin, product("B"));
    expect(await createProduct(admin, product("B"))).toEqual({ ok: false, errors: { sku: "รหัสนี้มีอยู่แล้ว" } });
    expect(await createProduct(admin, { ...product("B2"), sku: "ADP-20W" })).toEqual({ ok: false, errors: { sku: "รหัสนี้มีอยู่แล้ว" } });
    expect(await createProduct(admin, product("B3", { floorPrice: 90 }))).toMatchObject({ ok: false, errors: { floorPrice: expect.any(String) } });
  });
});

describe("ของแถม", () => {
  it("เพิ่ม → แก้ → ปิดใช้ → ลบ · ปิดแล้ว Deal Engine ไม่เห็น", async () => {
    const gift = { sku: sku("G"), name: "เคสทดสอบ", unitCost: 5, perceivedValue: 30, qtyAvailable: 100, enabled: true };
    expect(await saveGift(admin, gift)).toEqual({ ok: true });
    expect(await saveGift(admin, { ...gift, qtyAvailable: 80, enabled: false }, sku("G"))).toEqual({ ok: true });
    const page = await readProductSettings(admin);
    expect(page.gifts.find((g) => g.sku === sku("G"))).toMatchObject({ qtyAvailable: 80, enabled: false });
    const config = await new SupabaseChatStore(admin).loadConfig();
    expect(config.deadStock.some((d) => d.sku === sku("G"))).toBe(false);

    await deleteItem(admin, "gift", sku("G"));
    expect((await readProductSettings(admin)).gifts.some((g) => g.sku === sku("G"))).toBe(false);
  });
});

describe("รูปสินค้า", () => {
  it("อัปโหลด → ลูกค้าเห็น URL ที่เปิดได้จริง · เปลี่ยนรูปแล้วรูปเก่าถูกลบ · ลบรูปได้", async () => {
    await createProduct(admin, product("IMG"));
    const first = await setImage(admin, "product", sku("IMG"), new File([PNG], "a.png", { type: "image/png" }));
    expect(first).toMatchObject({ ok: true });
    const url = first.ok ? first.imageUrl : "";
    expect((await fetch(url)).status).toBe(200);
    const config = await new SupabaseChatStore(admin).loadConfig();
    expect(toPublicProducts(config).find((p) => p.sku === sku("IMG"))?.imageUrl).toBe(url);

    const second = await setImage(admin, "product", sku("IMG"), new File([PNG], "b.png", { type: "image/png" }));
    expect(second.ok && second.imageUrl).not.toBe(url);
    // เช็กในที่เก็บโดยตรง — URL สาธารณะของรูปเก่าอาจยังเปิดได้สักพักจาก CDN cache
    const files = await admin.storage.from("product-images").list("product", { search: sku("IMG") });
    expect(files.data?.map((f) => f.name)).toEqual([second.ok ? second.imageUrl.split("/").at(-1) : ""]);

    await removeImage(admin, "product", sku("IMG"));
    expect((await readProductSettings(admin)).products.find((p) => p.sku === sku("IMG"))?.imageUrl).toBeUndefined();
  });

  it("ไฟล์ที่ไม่ใช่รูปจริง (แค่ตั้งชื่อ .png) → ไม่รับ", async () => {
    await createProduct(admin, product("FAKE"));
    const fake = new File([new TextEncoder().encode("<script>alert(1)</script>")], "x.png", { type: "image/png" });
    expect(await setImage(admin, "product", sku("FAKE"), fake)).toEqual({ ok: false, error: "ใช้ได้เฉพาะรูป JPG, PNG หรือ WebP" });
  });
});

describe("นำเข้าจาก Excel/CSV", () => {
  it("เพิ่มใหม่ + แก้ของเดิมในคำสั่งเดียว", async () => {
    await createProduct(admin, product("U"));
    const result = await importProducts(admin, [
      { line: 2, product: product("N1") },
      { line: 3, product: product("U", { listPrice: 220, name: "แก้ชื่อแล้ว" }) },
    ]);
    expect(result).toEqual({ ok: true, count: 2 });
    const page = await readProductSettings(admin);
    expect(page.products.find((p) => p.sku === sku("N1"))).toMatchObject({ listPrice: 200 });
    expect(page.products.find((p) => p.sku === sku("U"))).toMatchObject({ listPrice: 220, name: "แก้ชื่อแล้ว" });
  });

  it("มีแถวผิดแถวเดียว → ไม่บันทึกเลยสักแถว และบอกบรรทัดที่ผิด", async () => {
    const result = await importProducts(admin, [
      { line: 2, product: product("N2") },
      { line: 3, product: product("N3", { floorPrice: 10 }) },
    ]);
    expect(result).toMatchObject({ ok: false, rowErrors: [{ line: 3, errors: { floorPrice: expect.any(String) } }] });
    expect((await readProductSettings(admin)).products.some((p) => p.sku === sku("N2"))).toBe(false);
  });
});
