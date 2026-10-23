import { NextResponse, type NextRequest } from "next/server";
import { safeNextPath } from "@/lib/auth/routes";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * ปลายทางของลิงก์ในอีเมล (ยืนยันอีเมล / ตั้งรหัสผ่านใหม่)
 * รับเฉพาะ ?code= (PKCE) — ลิงก์ต้องเปิดใน browser เดียวกับที่ขอ
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const next = safeNextPath(searchParams.get("next"));
  const supabase = await createSupabaseServerClient();

  // PKCE เท่านั้น: ต้องมี code_verifier ใน cookie ของ browser ที่ขอลิงก์เอง
  // (แบบ token_hash ใครส่งลิงก์ของบัญชีตัวเองมาให้กด ก็ทำให้เหยื่อล็อกอินเป็นบัญชีคนอื่นได้ — login CSRF)
  const code = searchParams.get("code");
  const { error } = code ? await supabase.auth.exchangeCodeForSession(code) : { error: new Error("missing code") };

  if (error) return NextResponse.redirect(new URL("/login?error=link", origin));
  return NextResponse.redirect(new URL(next, origin));
}
