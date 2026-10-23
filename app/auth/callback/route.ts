import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { safeNextPath } from "@/lib/auth/routes";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * ปลายทางของลิงก์ในอีเมล (ยืนยันอีเมล / ตั้งรหัสผ่านใหม่)
 * รองรับทั้งแบบ ?code= (PKCE) และ ?token_hash=&type= (เทมเพลตอีเมลแบบใหม่)
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const next = safeNextPath(searchParams.get("next"));
  const supabase = await createSupabaseServerClient();

  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  const { error } = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : tokenHash && type
      ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
      : { error: new Error("missing code") };

  if (error) return NextResponse.redirect(new URL("/login?error=link", origin));
  return NextResponse.redirect(new URL(next, origin));
}
