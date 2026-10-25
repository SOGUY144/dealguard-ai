"use client";

import Link from "next/link";
import { useEffect } from "react";
import { StatusPage } from "@/components/ui/status-page";

/** เกิดข้อผิดพลาดที่ไม่คาดคิด — ไม่โชว์รายละเอียด error ให้ลูกค้า (log ไว้ที่ console) แต่ให้ลองใหม่ได้ */
export default function Error({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <StatusPage
      title="ขออภัย มีบางอย่างผิดพลาด"
      actions={
        <>
          <button type="button" onClick={() => retry()} className="btn-primary">
            ลองใหม่อีกครั้ง
          </button>
          <Link href="/" className="btn-secondary inline-flex items-center justify-center">
            กลับหน้าแรก
          </Link>
        </>
      }
    >
      ระบบสะดุดชั่วคราว ข้อมูลของคุณยังอยู่ครบ ลองใหม่ได้เลย
    </StatusPage>
  );
}
