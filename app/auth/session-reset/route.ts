import { NextResponse, type NextRequest } from "next/server";
import { safeNextPath, sessionResetAction } from "@/lib/auth/routes";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * ล้าง session ที่บัญชีไม่อยู่แล้ว (JWT ยังไม่หมดอายุแต่ไม่มี profile) แล้วไปหน้าล็อกอิน
 * ออกจากระบบเฉพาะกรณีนั้นเท่านั้น — ลิงก์นี้จึงใช้บังคับคนที่ยังมีบัญชีให้หลุดจากระบบไม่ได้
 */
export async function GET(request: NextRequest) {
  const next = safeNextPath(request.nextUrl.searchParams.get("next"));
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const sub = data?.claims?.sub;

  let profile: "found" | "missing" | "error" = "missing";
  if (sub) {
    const result = await supabase.from("profiles").select("id").eq("id", sub).maybeSingle();
    profile = result.error ? "error" : result.data ? "found" : "missing";
  }

  switch (sessionResetAction({ signedIn: Boolean(sub), profile })) {
    case "continue":
      return NextResponse.redirect(new URL(next, request.url));
    case "retry_later":
      // ไม่ redirect กลับหน้าเดิม (จะวนถ้าฐานข้อมูลยังล่ม) — ให้ผู้ใช้กดลองใหม่เอง
      return new NextResponse("ระบบขัดข้องชั่วคราว ลองรีเฟรชหน้านี้อีกครั้งในอีกสักครู่", {
        status: 503,
        headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store", "retry-after": "5" },
      });
    case "sign_out":
      await supabase.auth.signOut({ scope: "local" });
      break;
    case "login":
      break;
  }
  return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(next)}`, request.url));
}
