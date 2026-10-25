import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans_Thai } from "next/font/google";
import { MovingBackground } from "@/components/background/moving-background";
import { WelcomeCutscene } from "@/components/welcome/welcome-cutscene";
import { storefront } from "@/lib/config/storefront";
import "./globals.css";

const plexThai = IBM_Plex_Sans_Thai({
  variable: "--font-plex-thai",
  weight: ["300", "400", "500", "600", "700"],
  subsets: ["thai", "latin"],
});

const title = `${storefront.storeName} — แชตต่อราคา`;
const description = "ผู้ช่วย AI ของร้าน ตอบต่อราคาด้วยข้อเสนอที่ระบบของร้านคำนวณ";

// SITE_URL ตั้งไว้แล้วบน Vercel (ใช้ทำลิงก์ในอีเมลด้วย) — ให้รูปพรีวิวตอนแชร์ลิงก์เป็น URL เต็ม
function siteUrl(): URL | undefined {
  try {
    return process.env.SITE_URL ? new URL(process.env.SITE_URL) : undefined;
  } catch {
    return undefined;
  }
}

export const metadata: Metadata = {
  metadataBase: siteUrl(),
  title,
  description,
  applicationName: "DealGuard AI",
  openGraph: { type: "website", locale: "th_TH", siteName: storefront.storeName, title, description },
  twitter: { card: "summary_large_image", title, description },
  appleWebApp: { title: storefront.storeName, statusBarStyle: "default" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#F6F3FB",
  colorScheme: "light",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="th" className={`${plexThai.variable} h-full antialiased`}>
      {/* isolate: พื้นหลังเคลื่อนไหว (z ติดลบ) อยู่เหนือ mesh ของ body แต่ใต้เนื้อหา */}
      <body className="app-bg isolate min-h-full flex flex-col">
        <MovingBackground />
        {children}
        {/* คัตซีนหลังล็อกอิน — อยู่ที่ layout จึงค้างข้ามการเปลี่ยนหน้า แล้วจางให้เห็นหน้าใหม่ */}
        <WelcomeCutscene storeName={storefront.storeName} />
      </body>
    </html>
  );
}
