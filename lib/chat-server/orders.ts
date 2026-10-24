// อ่านออเดอร์ให้หน้า /order/[id] ด้วย client ของผู้ใช้ — RLS ให้ลูกค้าเห็นแค่ออเดอร์ของตัวเอง (owner เห็นทั้งหมด)
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { OrderView } from "@/lib/chat/mock-orders";
import { toOffer } from "./supabase-store";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function readOrder(db: SupabaseClient, id: string): Promise<OrderView | null> {
  if (!UUID.test(id)) return null;
  const { data, error } = await db
    .from("orders")
    .select("id, product_name, created_at, confirmed_at, paid_at, offers(*)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`[orders] อ่านออเดอร์: ${error.message}`);
  if (!data?.offers) return null;
  return {
    id: String(data.id),
    productName: String(data.product_name),
    at: new Date(String(data.created_at)).toISOString(),
    confirmedAt: data.confirmed_at ? new Date(String(data.confirmed_at)).toISOString() : null,
    paidAt: data.paid_at ? new Date(String(data.paid_at)).toISOString() : null,
    offer: toOffer(data.offers as unknown as Record<string, unknown>),
  };
}
