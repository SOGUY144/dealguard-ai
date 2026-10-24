// อ่าน/บันทึกคำตอบให้ลูกค้า (หน้า /owner/products) — อ่านด้วยสิทธิ์เถ้าแก่ (RLS) · บันทึกด้วย service role หลังเช็กสิทธิ์แล้ว
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SaveResult } from "./product-settings";
import { cleanShopAnswers, validateShopAnswers, type ShopAnswers } from "./shop-answers";

/** null = ไม่ใช่เถ้าแก่ (RLS ไม่คืนแถวร้าน) */
export async function readShopAnswers(db: SupabaseClient): Promise<ShopAnswers | null> {
  const res = await db.from("merchants").select("delivery_info, stock_info").order("created_at").limit(1).maybeSingle();
  if (res.error) throw new Error(`[owner] อ่านคำตอบให้ลูกค้า: ${res.error.message}`);
  if (!res.data) return null;
  return { delivery: String(res.data.delivery_info ?? ""), stock: String(res.data.stock_info ?? "") };
}

export async function saveShopAnswers(admin: SupabaseClient, input: ShopAnswers): Promise<SaveResult> {
  const answers = cleanShopAnswers(input);
  const errors = validateShopAnswers(answers);
  if (Object.keys(errors).length > 0) return { ok: false, errors };

  // ร้านเดียว — แถวแรกเหมือน RPC อื่นของหน้านี้
  const shop = await admin.from("merchants").select("id").order("created_at").limit(1).single();
  if (shop.error) throw new Error(`[owner] หาร้าน: ${shop.error.message}`);
  const { error } = await admin
    .from("merchants")
    .update({ delivery_info: answers.delivery, stock_info: answers.stock })
    .eq("id", shop.data.id);
  if (error) throw new Error(`[owner] บันทึกคำตอบให้ลูกค้า: ${error.message}`);
  return { ok: true };
}
