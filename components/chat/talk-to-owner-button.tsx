"use client";

// ปุ่ม "คุยกับเฮียชัยโดยตรง" นอกหน้าแชต (ใบสรุปออเดอร์ / ติดต่อร้าน) — ส่งเรื่องให้เถ้าแก่แบบเดียวกับปุ่ม "คุยกับคนจริง" แล้วพากลับไปแชต
import { LoaderCircle, User } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { buttonClass } from "@/components/ui/button";

type Props = { ownerName: string; className?: string; /** หน้าที่กลับมาหลังล็อกอิน */ from?: string };

export function TalkToOwnerButton({ ownerName, className, from = "/contact" }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onClick() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: "talk_to_human" }),
      });
      if (res.status === 401) {
        router.push(`/login?next=${encodeURIComponent(from)}`);
        return;
      }
      if (res.status === 403) {
        setError("ใช้ได้เฉพาะบัญชีลูกค้า");
        return;
      }
      if (!res.ok) throw new Error(`chat ${res.status}`);
      router.push("/");
    } catch {
      setError("ส่งเรื่องไม่สำเร็จ ลองใหม่อีกครั้ง หรือติดต่อทางช่องทางของร้าน");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <button
        type="button"
        onClick={() => void onClick()}
        disabled={busy}
        aria-busy={busy}
        className={buttonClass("white", className ?? "h-12 font-medium text-accent-ink shadow-none")}
      >
        {busy ? <LoaderCircle aria-hidden="true" size={17} className="motion-safe:animate-spin" /> : <User aria-hidden="true" size={17} />}
        คุยกับ{ownerName}โดยตรง
      </button>
      {error && (
        <span role="alert" className="text-center text-xs text-warn-ink">
          {error}
        </span>
      )}
    </div>
  );
}
