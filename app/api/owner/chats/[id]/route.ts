// API แชตฝั่งเถ้าแก่ — GET อ่านแชต · POST ตอบเอง / ปิดเรื่อง / ให้ AI ตอบต่อ / อนุมัติราคา (owner เท่านั้น)
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/dal";
import { isSameOrigin } from "@/lib/auth/routes";
import { createChatDeps } from "@/lib/chat-server/deps";
import { OWNER_MAX_CREDIT_DAYS, OWNER_TEXT_MAX, ownerAction } from "@/lib/chat-server/owner-actions";
import { readOwnerChat } from "@/lib/owner/chat";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const actionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("reply"), text: z.string().min(1).max(OWNER_TEXT_MAX * 2) }),
  z.object({ type: z.literal("resolve") }),
  z.object({ type: z.literal("handback") }),
  z.object({
    type: z.literal("approve_price"),
    sku: z.string().min(1).max(64),
    pricePerUnit: z.number().positive().max(10_000_000),
    qty: z.number().int().positive().max(10_000_000),
    creditDays: z.number().int().min(0).max(OWNER_MAX_CREDIT_DAYS),
  }),
]);

const NO_STORE = { "cache-control": "no-store" };
const fail = (status: number, error: string) => NextResponse.json({ error }, { status, headers: NO_STORE });

/** owner เท่านั้น — ลูกค้าเปิด API นี้ไม่ได้แม้รู้ id แชต */
async function ownerOnly() {
  const user = await getCurrentUser();
  if (!user) return fail(401, "unauthorized");
  if (user.role !== "owner") return fail(403, "owners_only");
  return null;
}

async function respond(chatId: string) {
  // อ่านกลับด้วยสิทธิ์ของ owner (RLS) ไม่ใช่ service role
  const view = await readOwnerChat(await createSupabaseServerClient(), chatId);
  return view ? NextResponse.json(view, { headers: NO_STORE }) : fail(404, "chat_not_found");
}

export async function GET(_request: NextRequest, ctx: RouteContext<"/api/owner/chats/[id]">) {
  try {
    const denied = await ownerOnly();
    if (denied) return denied;
    return await respond((await ctx.params).id);
  } catch (err) {
    console.error("[api/owner/chats]", err);
    return fail(503, "chat_unavailable");
  }
}

export async function POST(request: NextRequest, ctx: RouteContext<"/api/owner/chats/[id]">) {
  if (!isSameOrigin(request.headers.get("origin"), request.nextUrl.origin)) return fail(403, "forbidden");
  const parsed = actionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail(400, "invalid_action");
  try {
    const denied = await ownerOnly();
    if (denied) return denied;
    const { id } = await ctx.params;
    if (!(await readOwnerChat(await createSupabaseServerClient(), id))) return fail(404, "chat_not_found");
    await ownerAction(createChatDeps().store, id, parsed.data);
    return await respond(id);
  } catch (err) {
    console.error("[api/owner/chats]", err);
    return fail(503, "chat_unavailable");
  }
}
