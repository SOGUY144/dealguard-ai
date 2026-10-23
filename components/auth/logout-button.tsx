import type { ReactNode } from "react";

/** POST ไป /auth/logout แบบฟอร์มธรรมดา → browser โหลดหน้าใหม่ทั้งหน้า (ดู app/auth/logout/route.ts) */
export function LogoutForm({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <form action="/auth/logout" method="post" className={className}>
      {children}
    </form>
  );
}
