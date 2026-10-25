// บัญชีทดลองให้กรรมการ — โชว์บนหน้าเข้าสู่ระบบ ตั้งใจให้เป็นสาธารณะ ไม่ใช่ความลับ (ทีมสั่ง 25 ต.ค. 2569)
// ลูกค้า: มีแชตต่อราคาที่คุยกับ AI จริงไว้แล้ว · `demo:reset` ลบแชตนี้ด้วย
// เถ้าแก่: ใครก็ล็อกอินได้ แก้ราคา/สินค้าของร้านเดโมได้ทั้งหมด
export type DemoAccount = { label: string; note: string; email: string; password: string };

export const demoAccounts: DemoAccount[] = [
  {
    label: "ลูกค้า",
    note: "มีแชตต่อราคากับ AI ไว้ให้ดูแล้ว เข้าไปคุยต่อได้เลย",
    email: "demo.buyer@dealguard.test",
    password: "dealguard2569",
  },
  {
    label: "เถ้าแก่",
    note: "ดูภาพรวมยอดขาย ออเดอร์ อนุมัติราคา และตั้งราคาสินค้า",
    email: "owner@dealguard.test",
    password: "Fahat456",
  },
];
