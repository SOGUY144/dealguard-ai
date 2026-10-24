// ช่อง Realtime ที่หน้าเว็บฟัง — Supabase ส่งเฉพาะแถวที่ผู้ใช้คนนั้นอ่านได้ตาม RLS
import type { ConnectLive } from "@/components/live/use-live-updates";
import { getSupabaseBrowserClient } from "./client";

type Watch = { table: "orders" | "escalations" | "messages" | "chats"; event: "INSERT" | "UPDATE" | "*"; filter?: string };

function connect(name: string, watches: Watch[]): ConnectLive {
  return (onChange, onStatus) => {
    const supabase = getSupabaseBrowserClient();
    let disposed = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    // ผูก token ของผู้ใช้ก่อนเข้าช่อง — เปิดหน้าใหม่ session ยังโหลดจาก cookie ไม่เสร็จ ถ้าเข้าช่องเลยจะเข้าด้วยสิทธิ์ anon
    // แล้ว RLS ตัดทุกเหตุการณ์ทิ้งเงียบๆ (ต่อติด แต่ไม่ได้ยินอะไร) — ส่ง token ทีหลังก็ไม่ช่วย ต้องเข้าช่องด้วย token ตั้งแต่แรก
    void supabase.auth
      .getSession()
      .then(async ({ data }: { data: { session: { access_token: string } | null } }) => {
        if (disposed) return;
        if (data.session) await supabase.realtime.setAuth(data.session.access_token);
        if (disposed) return;
        // ชื่อช่องไม่ซ้ำต่อการเปิดหน้า: ช่องเก่าที่กำลังปิด (กลับหน้าเร็วๆ / StrictMode) จะไม่ถูกเอามาใช้ซ้ำแล้วเงียบ
        let ch = supabase.channel(`${name}-${crypto.randomUUID()}`);
        for (const w of watches) {
          ch = ch.on(
            "postgres_changes",
            { event: w.event, schema: "public", table: w.table, ...(w.filter ? { filter: w.filter } : {}) },
            onChange,
          );
        }
        channel = ch;
        ch.subscribe((status: string) => {
          // CLOSED ตอนเราเลิกฟังเองไม่ใช่การหลุด
          if (disposed) return;
          if (status === "SUBSCRIBED") onStatus("live");
          else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") onStatus("offline");
        });
      })
      .catch(() => {
        if (!disposed) onStatus("offline");
      });

    return () => {
      disposed = true;
      if (channel) void supabase.removeChannel(channel);
    };
  };
}

/** หน้าภาพรวมเถ้าแก่: ออเดอร์ใหม่ / ยืนยันรับเงิน (อีกแท็บ) / เรื่องที่ส่งต่อ / ข้อความใหม่ (แชตที่กำลังคุย) */
export const connectOwnerDashboard = connect("owner-dashboard", [
  { table: "orders", event: "*" },
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

/** ใบสรุปออเดอร์ของลูกค้า: ร้านกด "ได้รับเงินแล้ว" → สถานะเปลี่ยนเอง (RLS: ลูกค้าได้ยินเฉพาะออเดอร์ของตัวเอง) */
export function connectOrder(orderId: string): ConnectLive {
  return connect(`order-${orderId}`, [{ table: "orders", event: "UPDATE", filter: `id=eq.${orderId}` }]);
}
