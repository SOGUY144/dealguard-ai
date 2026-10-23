// service role ข้าม RLS ได้ทั้งหมด — ใช้เฉพาะ server (Deal Engine, API, seed) ห้ามถึง browser เด็ดขาด
import "server-only";
import { createClient } from "@supabase/supabase-js";
import { supabaseEnv } from "./env";

export function createSupabaseAdminClient() {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("ยังไม่ได้ตั้ง SUPABASE_SERVICE_ROLE_KEY ใน .env.local");
  return createClient(supabaseEnv().url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
