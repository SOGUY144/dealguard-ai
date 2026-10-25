import type { MetadataRoute } from "next";
import { storefront } from "@/lib/config/storefront";

/** ให้ "เพิ่มลงหน้าจอโฮม" ได้ เปิดแล้วเหมือนแอป (ไม่มีแถบ browser) */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${storefront.storeName} — แชตต่อราคา`,
    short_name: storefront.storeName,
    description: "ผู้ช่วย AI ของร้าน ตอบต่อราคาด้วยข้อเสนอที่ระบบของร้านคำนวณ",
    lang: "th",
    start_url: "/",
    display: "standalone",
    background_color: "#F6F3FB",
    theme_color: "#F6F3FB",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
