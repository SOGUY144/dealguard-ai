// ช่อง Realtime ที่หน้าเว็บฟัง — Supabase ส่งเฉพาะแถวที่ผู้ใช้คนนั้นอ่านได้ตาม RLS
import type { ConnectLive } from "@/components/live/use-live-updates";
import { getSupabaseBrowserClient } from "./client";

type Watch = { table: "orders" | "escalations" | "messages" | "chats"; event: "INSERT" | "UPDATE" | "*"; filter?: string };

function connect(name: string, watches: Watch[]): ConnectLive {
  return (onChange, onStatus) => {
    const supabase = getSupabaseBrowserClient();
    // ชื่อช่องไม่ซ้ำต่อการเปิดหน้า: ช่องเก่าที่กำลังปิด (กลับหน้าเร็วๆ / StrictMode) จะไม่ถูกเอามาใช้ซ้ำแล้วเงียบ
    let disposed = false;
    let channel = supabase.channel(`${name}-${crypto.randomUUID()}`);
    for (const w of watches) {
      channel = channel.on(
        "postgres_changes",
        { event: w.event, schema: "public", table: w.table, ...(w.filter ? { filter: w.filter } : {}) },
        onChange,
      );
    }
    channel.subscribe((status: string) => {
      // CLOSED ตอนเราเลิกฟังเองไม่ใช่การหลุด
      if (disposed) return;
      if (status === "SUBSCRIBED") onStatus("live");
      else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") onStatus("offline");
    });
    return () => {
      disposed = true;
      void supabase.removeChannel(channel);
    };
  };
}

/** หน้าภาพรวมเถ้าแก่: ออเดอร์ใหม่ / เรื่องที่ส่งต่อ / ข้อความใหม่ (แชตที่กำลังคุย) */
export const connectOwnerDashboard = connect("owner-dashboard", [
  { table: "orders", event: "INSERT" },
  { table: "escalations", event: "*" },
  { table: "messages", event: "INSERT" },
]);

/** แชตหนึ่งห้อง (ทั้งฝั่งลูกค้าและเถ้าแก่): ข้อความใหม่ / โหมดเปลี่ยน */
export function connectChat(chatId: string): ConnectLive {
  return connect(`chat-${chatId}`, [
    { table: "messages", event: "INSERT", filter: `chat_id=eq.${chatId}` },
    { table: "chats", event: "UPDATE", filter: `id=eq.${chatId}` },
  ]);
}
