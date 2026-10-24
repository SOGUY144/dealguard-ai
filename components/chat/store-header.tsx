import { CircleHelp, House, LogOut, MessageCircle } from "lucide-react";
import Link from "next/link";
import { LogoutForm } from "@/components/auth/logout-button";

export type StorePage = "chat" | "how" | "contact";
type Props = { storeName: string; tagline: string; canLogout?: boolean; current?: StorePage };

const ITEM = "flex h-[42px] items-center gap-2 rounded-full px-[18px] text-sm whitespace-nowrap";
const ACTIVE = `${ITEM} bg-white font-semibold text-accent-ink shadow-[0_4px_12px_rgba(110,90,170,0.14)]`;
const IDLE = `${ITEM} font-medium text-ink hover:bg-white/60`;
const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

export const STORE_LINKS = [
  { page: "chat", href: "/", label: "แชตต่อราคา", icon: MessageCircle },
  { page: "how", href: "/how-to-order", label: "วิธีสั่งซื้อ", icon: CircleHelp },
  { page: "contact", href: "/contact", label: "ติดต่อร้าน", icon: House },
] as const;

/** แคปซูลลอยบนสุดของหน้าลูกค้า (คอมเท่านั้น — มือถือใช้ปุ่มเมนูที่หัวแชต) */
export function StoreHeader({ storeName, tagline, canLogout, current = "chat" }: Props) {
  return (
    <header className="mx-auto hidden w-full max-w-[1320px] px-8 pt-5 md:block">
      <div className="glass-pill flex flex-wrap items-center justify-between gap-x-6 gap-y-3 py-2 pr-2 pl-6">
        <Link href="/" className="flex flex-col whitespace-nowrap text-ink no-underline">
          <span className="text-lg leading-[1.4] font-semibold">{storeName}</span>
          <span className="text-[13px] leading-[1.4] text-muted">{tagline}</span>
        </Link>
        <nav aria-label="เมนูร้าน" className="flex items-center gap-0.5 rounded-full bg-[rgba(239,233,253,0.8)] p-1">
          {STORE_LINKS.map(({ page, href, label, icon: Icon }) => (
            <Link
              key={page}
              href={href}
              aria-current={page === current ? "page" : undefined}
              className={`${page === current ? ACTIVE : IDLE} ${FOCUS}`}
            >
              <Icon aria-hidden="true" size={17} className={page === current ? undefined : "text-accent"} />
              {label}
            </Link>
          ))}
          {canLogout && (
            <LogoutForm>
              <button type="submit" className={`${ITEM} font-medium text-muted hover:text-ink ${FOCUS}`}>
                <LogOut aria-hidden="true" size={17} />
                ออกจากระบบ
              </button>
            </LogoutForm>
          )}
        </nav>
      </div>
    </header>
  );
}
