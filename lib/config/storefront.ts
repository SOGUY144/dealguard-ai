// ข้อมูลร้านที่ลูกค้าเห็นได้ ส่งเป็น props ให้ client component (สินค้าอ่านจากฐานข้อมูลใน lib/chat-server/pipeline.ts)
// ต้องเป็น server-only: ถ้า browser import ไฟล์นี้ JSON ทั้งก้อน (รวมต้นทุน/ราคาพื้น) จะถูก bundle ไปด้วย
import "server-only";
import merchant from "./merchant.json";
import type { Storefront } from "@/lib/chat/types";

// ค่าใน [วงเล็บเหลี่ยม] คือ placeholder จากดีไซน์ ต้องให้ทีมใส่ข้อมูลจริง ห้ามแต่งเอง
export const storefront: Storefront = {
  storeName: merchant.merchantName,
  tagline: "ขายส่งอุปกรณ์มือถือ",
  ownerName: merchant.ownerDisplayName,
  assistantName: `ผู้ช่วย AI ของ${merchant.ownerDisplayName}`,
  bankAccountName: "[ชื่อบัญชีร้าน]",
  contactChannel: "[ช่องทางติดต่อของร้าน]",
  orderRefPlaceholder: "[เลขออเดอร์]",
};
