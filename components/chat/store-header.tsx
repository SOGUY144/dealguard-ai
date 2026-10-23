import { CircleHelp, House, LogOut, MessageCircle } from "lucide-react";
import Link from "next/link";
import { LogoutForm } from "@/components/auth/logout-button";

type Props = { storeName: string; tagline: string; canLogout?: boolean };

const ITEM = "flex h-[42px] items-center gap-2 rounded-full px-[18px] text-sm whitespace-nowrap";

/**
 * แคปซูลลอยบนสุดของหน้าลูกค้า (คอมเท่านั้น — มือถือไม่มีในดีไซน์)
 * "วิธีสั่งซื้อ" กับ "ติดต่อร้าน" ยังไม่มีเนื้อหาจากทีม จึงแสดงไว้แต่ยังกดไม่ได้
 */
export function StoreHeader({ storeName, tagline, canLogout }: Props) {
  return (
    <header className="mx-auto hidden w-full max-w-[1320px] px-8 pt-5 md:block">
      <div className="glass-pill flex flex-wrap items-center justify-between gap-x-6 gap-y-3 py-2 pr-2 pl-6">
        <Link href="/" className="flex flex-col whitespace-nowrap text-ink no-underline">
          <span className="text-lg leading-[1.4] font-semibold">{storeName}</span>
          <span className="text-[13px] leading-[1.4] text-muted">{tagline}</span>
        </Link>
        <nav aria-label="เมนูร้าน" className="flex items-center gap-0.5 rounded-full bg-[rgba(239,233,253,0.8)] p-1">
          <Link
            href="/"
            aria-current="page"
            className={`${ITEM} bg-white font-semibold text-accent-ink shadow-[0_4px_12px_rgba(110,90,170,0.14)]`}
          >
            <MessageCircle aria-hidden="true" size={17} />
            แชตต่อราคา
          </Link>
          <span aria-disabled="true" className={`${ITEM} cursor-not-allowed font-medium text-ink opacity-70`}>
            <CircleHelp aria-hidden="true" size={17} className="text-accent" />
            วิธีสั่งซื้อ
          </span>
          <span aria-disabled="true" className={`${ITEM} cursor-not-allowed font-medium text-ink opacity-70`}>
            <House aria-hidden="true" size={17} className="text-accent" />
            ติดต่อร้าน
          </span>
          {canLogout && (
            <LogoutForm>
              <button type="submit" className={`${ITEM} font-medium text-muted hover:text-ink`}>
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
