import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseEnv } from "./env";

/**
 * client ของผู้ใช้ที่ล็อกอินอยู่ (สิทธิ์ตาม RLS) — สร้างใหม่ทุก request ห้ามแชร์ข้าม request
 * อ่าน cookies() จึงต้องเรียกใน component ที่อยู่หลัง <Suspense> (Cache Components)
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  const { url, publishableKey } = supabaseEnv();
  return createServerClient(url, publishableKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options);
        } catch {
          // Server Component เขียน cookie ไม่ได้ — proxy.ts ต่ออายุ session ให้แล้ว
        }
      },
    },
  });
}
