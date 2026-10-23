// เถ้าแก่ตอบเอง / ปิดเรื่อง / ให้ AI ตอบต่อ บน Supabase จริง + สิทธิ์อ่านแชต (RLS)
// รัน: npm run test:db (ต้อง db:migrate + db:seed ก่อน) — ผู้ใช้ทดสอบถูกลบตอนจบ
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ownerAction } from "@/lib/chat-server/owner-actions";
import { handleAction, loadChat, type PipelineDeps } from "@/lib/chat-server/pipeline";
import { SupabaseChatStore } from "@/lib/chat-server/supabase-store";
import { readOwnerChat } from "@/lib/owner/chat";

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
const store = () => new SupabaseChatStore(admin);
const deps = (): PipelineDeps => ({ store: store(), storefront, intentLlm: null });

const created: string[] = [];
async function makeUser(role: "buyer" | "owner", displayName: string) {
  const email = `ochat-${randomBytes(4).toString("hex")}@dealguard.test`;
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
let other: Awaited<ReturnType<typeof makeUser>>;
let chatId: string;

beforeAll(async () => {
  [owner, buyer, other] = await Promise.all([
    makeUser("owner", "เถ้าแก่แชต"),
    makeUser("buyer", "คุณคืนเงิน"),
    makeUser("buyer", "คนอื่น"),
  ]);
  await handleAction(deps(), buyer, { type: "send", text: "ของเสีย 50 ชิ้น ขอคืนเงิน", inputMode: "text" });
  chatId = (await loadChat(deps(), buyer)).chatId!;
});

afterAll(async () => {
  await Promise.all(created.map((id) => admin.auth.admin.deleteUser(id)));
});

describe("แชตเถ้าแก่ (Owner-Chat)", () => {
  it("owner อ่านแชต + สรุปจาก AI ได้ · ลูกค้าคนอื่นอ่านไม่ได้", async () => {
    const view = await readOwnerChat(owner.client, chatId);
    expect(view).toMatchObject({ mode: "human", buyerName: "คุณคืนเงิน", escalation: { kind: "refund", status: "open" } });
    expect(view!.escalation!.brief).toHaveLength(3);
    expect(await readOwnerChat(other.client, chatId)).toBeNull();
  });

  it("เถ้าแก่ตอบ → ลูกค้าเห็นข้อความ (owner_text) ในแชตของตัวเอง", async () => {
    await ownerAction(store(), chatId, { type: "reply", text: "ขอรูปของที่เสียหน่อยครับ" });
    const asBuyer = await buyer.client.from("messages").select("type, body").eq("chat_id", chatId).order("seq");
    expect(asBuyer.data!.at(-1)).toMatchObject({ type: "owner_text", body: { text: "ขอรูปของที่เสียหน่อยครับ" } });
    const view = await loadChat(deps(), buyer);
    expect(view.messages.at(-1)).toMatchObject({ type: "owner_text", text: "ขอรูปของที่เสียหน่อยครับ" });
  });

  it("ปิดเรื่อง → escalation resolved · เถ้าแก่ยังคุยเอง", async () => {
    await ownerAction(store(), chatId, { type: "resolve" });
    const view = await readOwnerChat(owner.client, chatId);
    expect(view).toMatchObject({ mode: "human", escalation: { status: "resolved" } });
  });

  it("ให้ AI ตอบต่อ → โหมด ai · ลูกค้าได้ข้อความแจ้ง · AI ตอบต่อได้จริง", async () => {
    await ownerAction(store(), chatId, { type: "handback" });
    const view = await readOwnerChat(owner.client, chatId);
    expect(view!.mode).toBe("ai");
    expect(view!.messages.at(-1)).toMatchObject({ type: "system", kind: "ai_resumed" });

    await handleAction(deps(), buyer, { type: "pick_product", sku: "CBL-C-1M" });
    const after = await handleAction(deps(), buyer, { type: "send", text: "ขอ 125 ได้ไหม 1000 ชิ้น", inputMode: "text" });
    expect(after.messages.findLast((m) => m.type === "offers")).toBeDefined();
  });
});
