import { NextResponse, type NextRequest } from "next/server";
import { isSameOrigin } from "@/lib/auth/routes";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * ออกจากระบบด้วยฟอร์ม POST ธรรมดา (ไม่ใช่ server action) เพื่อให้ browser โหลดหน้าใหม่ทั้งหน้า
 * ล้างหน้าเก่าที่ Next เก็บไว้ในหน่วยความจำ — กันคนถัดไปที่ใช้เครื่องเดียวกันเห็นแชตของคนก่อน
 */
export async function POST(request: NextRequest) {
  if (!isSameOrigin(request.headers.get("origin"), request.nextUrl.origin)) {
    return new NextResponse("forbidden", { status: 403 });
  }
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  // 303 = ให้ browser เปลี่ยนเป็น GET ไปหน้าล็อกอิน
  return NextResponse.redirect(new URL("/login", request.url), { status: 303 });
}
