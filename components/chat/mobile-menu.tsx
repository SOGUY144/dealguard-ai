"use client";

// มือถือไม่มีแถบเมนูร้าน (ไม่มีในไฟล์ดีไซน์) — ปุ่มเมนูที่หัวแชตพาไปวิธีสั่งซื้อ / ติดต่อร้าน / นโยบาย / ออกจากระบบ
import { LogOut, Menu, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { LogoutForm } from "@/components/auth/logout-button";
import { IconButton } from "@/components/ui/button";
import { STORE_LINKS } from "./store-header";

const ROW = "flex min-h-11 w-full items-center gap-2.5 rounded-xl px-3 text-sm font-medium hover:bg-accent-tint focus-visible:outline-2 focus-visible:outline-accent";

export function MobileMenu({ canLogout }: { canLogout?: boolean }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onClick = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  return (
    <div ref={box} className="relative md:hidden">
      <IconButton label="เมนู" variant="ghost" aria-expanded={open} aria-controls={id} onClick={() => setOpen((v) => !v)}>
        <Menu aria-hidden="true" size={19} />
      </IconButton>
      {open && (
        <nav
          id={id}
          aria-label="เมนูร้าน (มือถือ)"
          className="glass absolute top-12 right-0 z-30 flex w-56 flex-col gap-0.5 rounded-2xl bg-white/95 p-1.5"
        >
          {STORE_LINKS.filter((l) => l.page !== "chat").map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} className={ROW} onClick={() => setOpen(false)}>
              <Icon aria-hidden="true" size={17} className="text-accent" />
              {label}
            </Link>
          ))}
          <Link href="/privacy" className={ROW} onClick={() => setOpen(false)}>
            <ShieldCheck aria-hidden="true" size={17} className="text-accent" />
            นโยบายความเป็นส่วนตัว
          </Link>
          {canLogout && (
            <LogoutForm>
              <button type="submit" className={`${ROW} text-muted`}>
                <LogOut aria-hidden="true" size={17} />
                ออกจากระบบ
              </button>
            </LogoutForm>
          )}
        </nav>
      )}
    </div>
  );
}
