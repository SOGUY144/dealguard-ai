import type { Metadata } from "next";
import { IBM_Plex_Sans_Thai } from "next/font/google";
import { MovingBackground } from "@/components/background/moving-background";
import "./globals.css";

const plexThai = IBM_Plex_Sans_Thai({
  variable: "--font-plex-thai",
  weight: ["300", "400", "500", "600", "700"],
  subsets: ["thai", "latin"],
});

export const metadata: Metadata = {
  title: "ร้านเฮียชัยโมบาย — แชตต่อราคา",
  description: "ผู้ช่วย AI ของร้าน ตอบต่อราคาด้วยข้อเสนอที่ระบบของร้านคำนวณ",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="th" className={`${plexThai.variable} h-full antialiased`}>
      {/* isolate: พื้นหลังเคลื่อนไหว (z ติดลบ) อยู่เหนือ mesh ของ body แต่ใต้เนื้อหา */}
      <body className="app-bg isolate min-h-full flex flex-col">
        <MovingBackground />
        {children}
      </body>
    </html>
  );
}
