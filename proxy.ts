import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { decideAccess } from "@/lib/auth/routes";
import { supabaseEnv } from "@/lib/supabase/env";

/**
 * ทุก request: ต่ออายุ session ของ Supabase แล้วเช็กเบื้องต้นว่าต้องล็อกอินไหม
 * การตรวจสิทธิ์จริง (role) อยู่ที่ lib/auth/dal.ts — proxy อย่างเดียวไม่พอ (คู่มือ Next 16)
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { url, publishableKey } = supabaseEnv();

  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
        // กัน CDN cache หน้าที่มี cookie ของ session แล้วส่งให้คนอื่น
        for (const [key, value] of Object.entries(headers)) response.headers.set(key, value);
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const decision = decideAccess({
    pathname: request.nextUrl.pathname,
    search: request.nextUrl.search,
    signedIn: Boolean(data?.claims?.sub),
  });
  if (decision === "allow") return response;

  // redirect ต้องพก cookie ที่เพิ่งต่ออายุไปด้วย ไม่งั้นผู้ใช้หลุดจากระบบ
  const redirect = NextResponse.redirect(new URL(decision.redirect, request.url));
  for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
  for (const key of ["cache-control", "expires", "pragma"]) {
    const value = response.headers.get(key);
    if (value) redirect.headers.set(key, value);
  }
  return redirect;
}

export const config = {
  // ข้ามไฟล์ static และรูปภาพ
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|mp3)$).*)"],
};
