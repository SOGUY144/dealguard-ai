import Link from "next/link";
import { StatusPage } from "@/components/ui/status-page";

/** เช่น เปิดลิงก์แชตที่ไม่มีแล้ว — พากลับหน้าเถ้าแก่ ไม่ใช่หน้าลูกค้า */
export default function OwnerNotFound() {
  return (
    <StatusPage
      code="404"
      title="ไม่พบรายการนี้"
      actions={
        <Link href="/owner" className="btn-primary inline-flex items-center justify-center">
          กลับหน้าเถ้าแก่
        </Link>
      }
    >
      แชตหรือรายการนี้อาจถูกลบ หรือลิงก์ไม่ถูกต้อง
    </StatusPage>
  );
}
