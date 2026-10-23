import type { Offer } from "./types";

// ข้อเสนอที่ Deal Engine คิดได้จากตัวอย่างใน SKILL (ขอ ฿125 × 1,000) — ใช้กับ mock จนกว่า API จะพร้อม (เฟส 4)
// test ใน __tests__/mock-offers.test.ts เช็กว่าตรงกับ engine จริงเสมอ
export const MOCK_OFFERS: Offer[] = [
  {
    id: "A",
    lever: "volume",
    label: "ซื้อเยอะ",
    pricePerUnit: 130,
    qty: 1500,
    conditionText: "เมื่อสั่ง 1,500 ชิ้น",
    total: 195_000,
    creditDays: 30,
  },
  {
    id: "B",
    lever: "cash",
    label: "จ่ายสด",
    pricePerUnit: 135,
    qty: 1000,
    conditionText: "1,000 ชิ้น · โอนทันที ไม่ใช้เครดิต",
    total: 135_000,
    creditDays: 0,
  },
  {
    id: "C",
    lever: "bundle",
    label: "รับของแถม",
    pricePerUnit: 145,
    qty: 1000,
    conditionText: "1,000 ชิ้น + หัวชาร์จ 20W 200 ชิ้น",
    total: 145_000,
    creditDays: 30,
    bundle: { sku: "ADP-20W", name: "หัวชาร์จ 20W", qty: 200 },
  },
];
