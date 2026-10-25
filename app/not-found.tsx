import type { Metadata } from "next";
import Link from "next/link";
import { StatusPage } from "@/components/ui/status-page";

export const metadata: Metadata = { title: "ไม่พบหน้านี้" };

export default function NotFound() {
  return (
    <StatusPage
      code="404"
      title="ไม่พบหน้านี้"
      actions={
        <>
          <Link href="/" className="btn-primary inline-flex items-center justify-center">
            กลับไปแชตต่อราคา
          </Link>
          <Link href="/how-to-order" className="btn-secondary inline-flex items-center justify-center">
            วิธีสั่งซื้อ
          </Link>
        </>
      }
    >
      ลิงก์อาจพิมพ์ผิด หรือหน้านี้ถูกย้ายไปแล้ว
    </StatusPage>
  );
}
