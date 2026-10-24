// แปลงเสียงเป็นข้อความ (ปุ่มไมค์) — ลูกค้า (ส่งเข้าแชต) และเถ้าแก่ (พูดแทนพิมพ์ในหน้าแชตเถ้าแก่) · ไม่เก็บไฟล์เสียง
import { NextResponse, type NextRequest } from "next/server";
import { checkAudio, createTranscriber } from "@/lib/ai/transcribe";
import { getCurrentUser } from "@/lib/auth/dal";
import { allow, LIMITS } from "@/lib/auth/rate-limit";
import { isSameOrigin } from "@/lib/auth/routes";
import { createChatDeps } from "@/lib/chat-server/deps";

const NO_STORE = { "cache-control": "no-store" };
const fail = (status: number, error: string) => NextResponse.json({ error }, { status, headers: NO_STORE });

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request.headers.get("origin"), request.nextUrl.origin)) return fail(403, "forbidden");
  try {
    const user = await getCurrentUser();
    if (!user) return fail(401, "unauthorized");
    // แปลงเสียงคิดเงินต่อวินาที — กันยิงรัวๆ เหมือนแชต
    if (!(await allow(`stt:user:${user.id}`, LIMITS.chatPerUser))) return fail(429, "too_many_requests");

    const transcribe = createTranscriber();
    if (!transcribe) return fail(503, "voice_unavailable");

    const form = await request.formData().catch(() => null);
    const file = form?.get("audio");
    if (!(file instanceof File)) return fail(400, "no_audio");
    const check = checkAudio(file);
    if (check !== "ok") return fail(check === "too_big" ? 413 : 400, check);

    const started = Date.now();
    const products = (await createChatDeps().store.loadConfig()).products.map((p) => p.name);
    const text = await transcribe(file, products);
    console.info(`[voice] stt ${Date.now() - started} ms · ${file.size} bytes · ${file.type}`);
    if (!text) return fail(422, "no_speech");
    return NextResponse.json({ text: text.slice(0, 500) }, { headers: NO_STORE });
  } catch (err) {
    console.error("[api/transcribe]", err);
    return fail(503, "transcribe_failed");
  }
}
