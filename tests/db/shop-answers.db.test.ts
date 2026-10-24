// คำตอบให้ลูกค้า (SKILL §11.3) บน Supabase จริง: เถ้าแก่บันทึก → ลูกค้าถามแล้วได้คำตอบนั้น · สิทธิ์ · ฐานข้อมูลกันข้อความยาวเกิน
// รัน: npm run test:db (ต้อง db:migrate ก่อน) — แก้คำตอบของร้านจริงชั่วคราว แล้วคืนค่าเดิมตอนจบ
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { handleAction, type PipelineDeps } from "@/lib/chat-server/pipeline";
import { SupabaseChatStore } from "@/lib/chat-server/supabase-store";
import { readShopAnswers, saveShopAnswers } from "@/lib/owner/shop-answers-store";
import type { ShopAnswers } from "@/lib/owner/shop-answers";

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
const deps = (): PipelineDeps => ({ store: new SupabaseChatStore(admin), storefront, intentLlm: null });

const created: string[] = [];
async function makeUser(role: "buyer" | "owner", displayName: string) {
  const email = `pipe-${randomBytes(4).toString("hex")}@dealguard.test`;
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
/** คำตอบจริงของร้านก่อนเทสต์ — คืนให้ตอนจบ */
let snapshot: ShopAnswers;

beforeAll(async () => {
  snapshot = (await readShopAnswers(admin))!;
  [owner, buyer] = await Promise.all([makeUser("owner", "เถ้าแก่คำตอบ"), makeUser("buyer", "คุณถามข้อมูล")]);
});

afterAll(async () => {
  expect(await saveShopAnswers(admin, snapshot)).toEqual({ ok: true });
  expect(await readShopAnswers(admin)).toEqual(snapshot);
  await Promise.all(created.map((id) => admin.auth.admin.deleteUser(id)));
});

describe("คำตอบให้ลูกค้า", () => {
  it("เถ้าแก่บันทึก → ลูกค้าถามส่งกี่วัน / มีของไหม ได้ข้อความนั้นตรงตัว", async () => {
    const answers = { delivery: "ทดสอบ: ส่งภายในวันถัดไป", stock: "ทดสอบ: มีของพร้อมส่ง" };
    expect(await saveShopAnswers(admin, answers)).toEqual({ ok: true });
    await handleAction(deps(), buyer, { type: "pick_product", sku: "CBL-C-1M" });
    const view = await handleAction(deps(), buyer, { type: "send", text: "มีของไหม ส่งกี่วัน", inputMode: "text" });
    expect(view.messages.findLast((m) => m.type === "ai_text")).toMatchObject({ text: `${answers.stock} ${answers.delivery}` });
  });

  it("เถ้าแก่อ่านได้ · ลูกค้าอ่านไม่ได้ และแก้ไม่ได้ (RLS)", async () => {
    expect(await readShopAnswers(owner.client)).toEqual({ delivery: "ทดสอบ: ส่งภายในวันถัดไป", stock: "ทดสอบ: มีของพร้อมส่ง" });
    expect(await readShopAnswers(buyer.client)).toBeNull();
    await buyer.client.from("merchants").update({ delivery_info: "แอบแก้" }).not("id", "is", null);
    expect((await readShopAnswers(admin))!.delivery).toBe("ทดสอบ: ส่งภายในวันถัดไป");
  });

  it("ฐานข้อมูลปฏิเสธข้อความยาวเกิน 300 ตัวอักษรเอง แม้ข้ามตัวตรวจในโค้ด", async () => {
    const { error } = await admin.from("merchants").update({ stock_info: "ก".repeat(301) }).not("id", "is", null);
    expect(error?.message).toMatch(/stock_info/);
  });
});
