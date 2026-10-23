// ต้องอ้าง process.env.NEXT_PUBLIC_* ตรงๆ ให้ Next ฝังค่าตอน build ได้
export function supabaseEnv(): { url: string; publishableKey: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !publishableKey) {
    throw new Error("ยังไม่ได้ตั้ง NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY ใน .env.local");
  }
  return { url, publishableKey };
}
