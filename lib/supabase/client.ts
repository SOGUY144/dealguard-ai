// client ฝั่ง browser (publishable key + session จาก cookie) — สิทธิ์ตาม RLS เท่านั้น ใช้ฟัง Realtime
import { createBrowserClient } from "@supabase/ssr";
import { supabaseEnv } from "./env";

let client: ReturnType<typeof createBrowserClient> | null = null;

export function getSupabaseBrowserClient() {
  if (!client) {
    const { url, publishableKey } = supabaseEnv();
    client = createBrowserClient(url, publishableKey);
  }
  return client;
}
