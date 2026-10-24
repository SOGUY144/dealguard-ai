// API แชตลูกค้า — GET โหลด/สร้างแชต · POST ส่งการกระทำ (ข้อความ, เลือกสินค้า, ยืนยันข้อเสนอ, คุยกับคน)
// ตัวเลขราคาทั้งหมดคิดที่ server · browser ส่งได้แค่ข้อความ + id ของข้อเสนอที่จะยืนยัน
import { after, NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { warmUpIntentLlm } from "@/lib/ai/openai";
import { getCurrentUser } from "@/lib/auth/dal";
import { allow, LIMITS } from "@/lib/auth/rate-limit";
import { isSameOrigin } from "@/lib/auth/routes";
import { createChatDeps } from "@/lib/chat-server/deps";
import { handleAction, loadChat } from "@/lib/chat-server/pipeline";

/** ข้อความยาวเกินนี้ตัดทิ้ง — กัน prompt ยาวผิดปกติ */
const MAX_TEXT = 500;

const actionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("pick_product"), sku: z.string().min(1).max(64) }),
  z.object({
    type: z.literal("send"),
    text: z.string().max(MAX_TEXT * 4).transform((t) => t.slice(0, MAX_TEXT)),
    inputMode: z.enum(["text", "voice"]),
  }),
  z.object({
    type: z.literal("confirm_offer"),
    messageId: z.string().min(1).max(64),
    offerId: z.enum(["A", "B", "C"]),
  }),
  z.object({ type: z.literal("talk_to_human") }),
]);

const NO_STORE = { "cache-control": "no-store" };
const fail = (status: number, error: string) => NextResponse.json({ error }, { status, headers: NO_STORE });

type Me = { id: string; displayName: string } | "not_buyer" | null;

/** แชตต่อราคาเป็นของบัญชีลูกค้าเท่านั้น — เถ้าแก่สั่งเองจะกลายเป็น "ดีลของ AI" บนหน้าเถ้าแก่ */
async function buyer(): Promise<Me> {
  const user = await getCurrentUser();
  if (!user) return null;
  return user.role === "buyer" ? { id: user.id, displayName: user.displayName } : "not_buyer";
}

export async function GET() {
  try {
    const me = await buyer();
    if (!me) return fail(401, "unauthorized");
    if (me === "not_buyer") return fail(403, "buyers_only");
    // ปลุก GPT ไว้ก่อนลูกค้าพิมพ์ข้อความแรก (request แรกหลังว่างนาน ช้า 7–13 วินาที)
    after(warmUpIntentLlm);
    return NextResponse.json(await loadChat(createChatDeps(), me), { headers: NO_STORE });
  } catch (err) {
    console.error("[api/chat]", err);
    return fail(503, "chat_unavailable");
  }
}

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request.headers.get("origin"), request.nextUrl.origin)) return fail(403, "forbidden");
  const parsed = actionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail(400, "invalid_action");

  try {
    const me = await buyer();
    if (!me) return fail(401, "unauthorized");
    if (me === "not_buyer") return fail(403, "buyers_only");
    // กันยิงรัวๆ (เปลือง GPT / ไล่หาเกณฑ์ของร้าน) — ลูกค้าจริงพิมพ์ไม่ถึง 30 ครั้งต่อนาที
    if (!(await allow(`chat:user:${me.id}`, LIMITS.chatPerUser))) return fail(429, "too_many_requests");
    return NextResponse.json(await handleAction(createChatDeps(), me, parsed.data), { headers: NO_STORE });
  } catch (err) {
    console.error("[api/chat]", err);
    return fail(503, "chat_unavailable");
  }
}
