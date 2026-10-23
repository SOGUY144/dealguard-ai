// ตรวจ RLS บน Supabase จริง: ลูกค้าเห็นได้แค่ของตัวเอง และไม่เห็นตัวเลขหลังบ้านเลย
// รัน: npm run test:db  (ต้อง db:migrate + db:seed ก่อน)
import { randomBytes } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const publishable = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const created: string[] = [];

async function makeUser(role: "buyer" | "owner", displayName: string) {
  const email = `rls-${randomBytes(4).toString("hex")}@dealguard.test`;
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
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw signInError;
  return { id: data.user.id, email, client };
}

let merchantId: string;
type TestUser = { id: string; email: string; client: SupabaseClient };
let buyerA: TestUser;
let buyerB: TestUser;
let owner: TestUser;
let chatA: string;

beforeAll(async () => {
  const { data: shop, error } = await admin.from("merchants").select("id").limit(1).single();
  if (error) throw new Error(`ยังไม่มีร้าน — รัน npm run db:seed ก่อน (${error.message})`);
  merchantId = shop.id;

  [buyerA, buyerB, owner] = await Promise.all([
    makeUser("buyer", "ลูกค้า A"),
    makeUser("buyer", "ลูกค้า B"),
    makeUser("owner", "เถ้าแก่ทดสอบ"),
  ]);

  // ข้อมูลแชตของลูกค้า A — เขียนด้วย service role เหมือน API จริง
  const chat = await admin.from("chats").insert({ merchant_id: merchantId, buyer_id: buyerA.id }).select("id").single();
  chatA = chat.data!.id;
  const message = await admin
    .from("messages")
    .insert({ chat_id: chatA, type: "buyer_text", input_mode: "text", body: { text: "ขอ 125" } })
    .select("id")
    .single();
  const offer = await admin
    .from("offers")
    .insert({
      chat_id: chatA,
      message_id: message.data!.id,
      letter: "A",
      lever: "volume",
      sku: "CBL-C-1M",
      label: "ซื้อเยอะ",
      price_per_unit: 130,
      qty: 1500,
      condition_text: "เมื่อสั่ง 1,500 ชิ้น",
      total: 195000,
      credit_days: 30,
    })
    .select("id")
    .single();
  await admin.from("offer_economics").insert({
    offer_id: offer.data!.id,
    margin_if_conceded: 25000,
    margin_offer: 45000,
    recovered_margin: 20000,
  });
  await admin.from("escalations").insert({
    merchant_id: merchantId,
    chat_id: chatA,
    kind: "refund",
    brief: ["ลูกค้า A ขอคืนเงิน", "-", "-"],
  });
});

afterAll(async () => {
  // ลบผู้ใช้ → profiles/chats/messages/offers ถูกลบตาม (on delete cascade)
  await Promise.all(created.map((id) => admin.auth.admin.deleteUser(id)));
});

describe("สมัครสมาชิก (trigger handle_new_user)", () => {
  const signupDirect = (metadata: Record<string, unknown>) =>
    createClient(url, publishable, { auth: { persistSession: false } }).auth.signUp({
      email: `rls-signup-${randomBytes(4).toString("hex")}@dealguard.test`,
      password: randomBytes(12).toString("base64url"),
      options: { data: metadata },
    });

  it("เรียก API สมัครตรงโดยไม่ยอมรับนโยบาย → สมัครไม่ได้", async () => {
    const { data, error } = await signupDirect({ display_name: "แอบสมัคร" });
    if (data.user) created.push(data.user.id);
    expect(error).not.toBeNull();
  });

  it("ส่งวันที่ยอมรับย้อนหลังมาเอง → ใช้เวลาของ server แทน", async () => {
    const before = Date.now();
    const { data, error } = await signupDirect({
      display_name: "ทดสอบเวลา",
      privacy_accepted: true,
      privacy_accepted_at: "2001-01-01T00:00:00Z",
    });
    expect(error).toBeNull();
    created.push(data.user!.id);
    const { data: profile } = await admin.from("profiles").select("privacy_accepted_at").eq("id", data.user!.id).single();
    expect(new Date(profile!.privacy_accepted_at).getTime()).toBeGreaterThanOrEqual(before - 60_000);
  });

  it("ชื่อที่มีตัวอักษรควบคุม (ขึ้นบรรทัด) ถูกล้างออก", async () => {
    const { data } = await signupDirect({ display_name: "คุณ\nนก\t", privacy_accepted: true });
    created.push(data.user!.id);
    const { data: profile } = await admin.from("profiles").select("display_name").eq("id", data.user!.id).single();
    expect(profile?.display_name).toBe("คุณนก");
  });
});

describe("profiles", () => {
  it("สมัครแล้วได้ profile role = buyer พร้อมชื่อและอีเมลอัตโนมัติ", async () => {
    const { data } = await buyerA.client
      .from("profiles")
      .select("role, display_name, email")
      .eq("id", buyerA.id)
      .single();
    expect(data).toEqual({ role: "buyer", display_name: "ลูกค้า A", email: buyerA.email });
  });

  it("เปลี่ยนอีเมลใน Auth แล้ว profiles ตามด้วย", async () => {
    const changed = buyerB.email.replace("rls-", "rls-changed-");
    await admin.auth.admin.updateUserById(buyerB.id, { email: changed, email_confirm: true });
    const { data } = await admin.from("profiles").select("email").eq("id", buyerB.id).single();
    expect(data?.email).toBe(changed);
  });

  it("ลูกค้าไม่เห็นอีเมลของลูกค้าคนอื่น", async () => {
    const { data } = await buyerA.client.from("profiles").select("email").eq("id", buyerB.id);
    expect(data).toEqual([]);
  });

  it("เถ้าแก่เห็นอีเมลลูกค้าไว้ติดต่อกลับ", async () => {
    const { data } = await owner.client.from("profiles").select("email").eq("id", buyerA.id).single();
    expect(data?.email).toBe(buyerA.email);
  });

  it("ลูกค้าเห็น profile ตัวเองคนเดียว", async () => {
    const { data } = await buyerA.client.from("profiles").select("id");
    expect(data?.map((p) => p.id)).toEqual([buyerA.id]);
  });

  it("ลูกค้าแก้ role ตัวเองเป็น owner ไม่ได้", async () => {
    await buyerA.client.from("profiles").update({ role: "owner" }).eq("id", buyerA.id);
    const { data } = await admin.from("profiles").select("role").eq("id", buyerA.id).single();
    expect(data?.role).toBe("buyer");
  });
});

describe("ตัวเลขหลังบ้าน — ลูกค้าเห็นไม่ได้", () => {
  it.each(["products", "dead_stock", "merchants", "offer_economics", "escalations"])("%s → ว่าง", async (table) => {
    const { data, error } = await buyerA.client.from(table).select("*");
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });
});

describe("แชตของคนอื่น", () => {
  it("ลูกค้า A เห็นแชต ข้อความ และข้อเสนอของตัวเอง", async () => {
    expect((await buyerA.client.from("chats").select("id")).data?.map((c) => c.id)).toContain(chatA);
    expect((await buyerA.client.from("messages").select("id").eq("chat_id", chatA)).data).toHaveLength(1);
    expect((await buyerA.client.from("offers").select("price_per_unit").eq("chat_id", chatA)).data).toEqual([
      { price_per_unit: 130 },
    ]);
  });

  it("ลูกค้า B เห็นแชตของ A ไม่ได้เลย", async () => {
    for (const table of ["chats", "messages", "offers"]) {
      const { data } = await buyerB.client.from(table).select("*").eq(table === "chats" ? "id" : "chat_id", chatA);
      expect(data).toEqual([]);
    }
  });

  it("ลูกค้าเขียนข้อความลงฐานข้อมูลตรงๆ ไม่ได้ (ต้องผ่าน API)", async () => {
    const { error } = await buyerA.client
      .from("messages")
      .insert({ chat_id: chatA, type: "buyer_text", body: { text: "แอบเขียน" } });
    expect(error).not.toBeNull();
  });
});

describe("เถ้าแก่", () => {
  it("เห็นต้นทุน ราคาพื้น margin และเรื่องที่ส่งต่อ", async () => {
    const products = await owner.client.from("products").select("sku, unit_cost, floor_price");
    expect(products.data?.length).toBeGreaterThan(0);
    const economics = await owner.client.from("offer_economics").select("recovered_margin");
    expect(economics.data?.length).toBeGreaterThan(0);
    const escalations = await owner.client.from("escalations").select("kind").eq("chat_id", chatA);
    expect(escalations.data).toEqual([{ kind: "refund" }]);
  });

  it("เห็นแชตของลูกค้าทุกคน", async () => {
    const { data } = await owner.client.from("chats").select("id").eq("id", chatA);
    expect(data).toHaveLength(1);
  });
});

describe("ยังไม่ล็อกอิน (anon)", () => {
  it("อ่านอะไรไม่ได้เลย", async () => {
    const anon = createClient(url, publishable, { auth: { persistSession: false } });
    for (const table of ["profiles", "products", "chats", "messages"]) {
      const { data, error } = await anon.from(table).select("*");
      // ไม่มี GRANT ให้ anon → error permission denied หรือได้ว่าง
      expect(error !== null || (data ?? []).length === 0).toBe(true);
    }
  });
});

describe("rate limit (hit_rate_limit)", () => {
  it("ครบจำนวนในช่วงเวลา → ไม่ให้ผ่าน · คนอื่น (key อื่น) ไม่โดนด้วย", async () => {
    const key = `test:${randomBytes(4).toString("hex")}`;
    const hit = async (k: string) => (await admin.rpc("hit_rate_limit", { p_key: k, p_window_seconds: 60, p_max: 2 })).data;
    expect(await hit(key)).toBe(true);
    expect(await hit(key)).toBe(true);
    expect(await hit(key)).toBe(false);
    expect(await hit(`${key}:other`)).toBe(true);
  });

  it("browser เรียกนับเองไม่ได้", async () => {
    const { error } = await buyerA.client.rpc("hit_rate_limit", { p_key: "x", p_window_seconds: 60, p_max: 1 });
    expect(error).not.toBeNull();
  });
});

describe("rate limit แบบดูอย่างเดียว + นับเฉพาะตอนพลาด (ล็อกอินผิด)", () => {
  it("check ไม่นับ · record นับ · ครบแล้ว check บอกว่าเกิน", async () => {
    const key = `test:fail:${randomBytes(4).toString("hex")}`;
    const check = async () => (await admin.rpc("check_rate_limit", { p_key: key, p_window_seconds: 60, p_max: 2 })).data;
    expect(await check()).toBe(true);
    expect(await check()).toBe(true);
    await admin.rpc("record_rate_hit", { p_key: key });
    expect(await check()).toBe(true);
    await admin.rpc("record_rate_hit", { p_key: key });
    expect(await check()).toBe(false);
  });

  it("browser เรียก check/record เองไม่ได้", async () => {
    expect((await buyerA.client.rpc("record_rate_hit", { p_key: "x" })).error).not.toBeNull();
    expect((await buyerA.client.rpc("check_rate_limit", { p_key: "x", p_window_seconds: 1, p_max: 1 })).error).not.toBeNull();
  });
});

