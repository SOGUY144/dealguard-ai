// API โหมดผู้ช่วยเถ้าแก่ — วางข้อความลูกค้าจาก LINE → ข้อเสนอ + ข้อความพร้อมคัดลอก (owner เท่านั้น · ไม่บันทึกอะไร)
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { parseIntent } from "@/lib/ai/intent";
import { createIntentLlm } from "@/lib/ai/openai";
import { getCurrentUser } from "@/lib/auth/dal";
import { allow, LIMITS } from "@/lib/auth/rate-limit";
import { isSameOrigin } from "@/lib/auth/routes";
import { toPublicProducts } from "@/lib/chat-server/pipeline";
import { SupabaseChatStore } from "@/lib/chat-server/supabase-store";
import { storefront } from "@/lib/config/storefront";
import { buildAssist } from "@/lib/owner/assist";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/** วางได้ทั้งบทสนทนาสั้นๆ — ยาวเกินตัดทิ้ง */
const MAX_TEXT = 1500;

const bodySchema = z.object({
  text: z.string().min(1).max(MAX_TEXT * 4).transform((t) => t.slice(0, MAX_TEXT)),
  buyerName: z.string().max(40).optional(),
});

const NO_STORE = { "cache-control": "no-store" };
const fail = (status: number, error: string) => NextResponse.json({ error }, { status, headers: NO_STORE });

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request.headers.get("origin"), request.nextUrl.origin)) return fail(403, "forbidden");
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail(400, "invalid_body");
  try {
    const user = await getCurrentUser();
    if (!user) return fail(401, "unauthorized");
    if (user.role !== "owner") return fail(403, "owners_only");
    if (!(await allow(`assist:${user.id}`, LIMITS.chatPerUser))) return fail(429, "too_many_requests");

    const text = parsed.data.text.trim();
    if (!text) return fail(400, "invalid_body");
    const config = await new SupabaseChatStore(createSupabaseAdminClient()).loadConfig();
    const products = toPublicProducts(config);
    // ร้านขายสินค้าเดียว → ข้อความที่ไม่บอกชื่อสินค้าก็หมายถึงตัวนั้น
    const lastSku = config.products.length === 1 ? config.products[0].sku : null;
    // วางมาหลายบรรทัด = บทสนทนาเดียวกัน → อ่านรวมกัน (ราคา/จำนวนอาจอยู่คนละบรรทัดกับคำปฏิเสธ)
    const joined = text.split(/\n+/).map((l) => l.trim()).filter(Boolean).join(" ");
    const { intent } = await parseIntent(joined, { products, lastSku, history: [] }, createIntentLlm());
    const result = buildAssist(config, intent, text, { buyerName: parsed.data.buyerName, products, storefront });
    return NextResponse.json(result, { headers: NO_STORE });
  } catch (err) {
    console.error("[api/owner/assist]", err);
    return fail(503, "assist_unavailable");
  }
}
