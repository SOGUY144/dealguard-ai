"use server";

import { requireOwner } from "@/lib/auth/dal";
import { productSettingsSchema } from "@/lib/owner/product-settings";
import { saveProductSettings, type SaveResult } from "@/lib/owner/products";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/** บันทึกการตั้งค่าสินค้า — เฉพาะเถ้าแก่ · ตรวจกฎก่อนบันทึก มีผลกับแชตลูกค้าข้อความถัดไปทันที */
export async function saveSettings(input: unknown): Promise<SaveResult> {
  await requireOwner();
  const parsed = productSettingsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, errors: { form: "ข้อมูลไม่ครบ ลองโหลดหน้าใหม่" } };
  try {
    return await saveProductSettings(createSupabaseAdminClient(), parsed.data);
  } catch (err) {
    console.error("[owner/products]", err);
    return { ok: false, errors: { form: "บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง" } };
  }
}
