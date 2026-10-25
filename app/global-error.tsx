"use client";

import { useEffect } from "react";

/**
 * error ที่ root layout เอง — หน้านี้แทนทั้งหน้า ไม่มี CSS/ฟอนต์ของเว็บ จึงจัดสไตล์ในตัว
 * (ไม่มี metadata ได้ — ใช้ <title> ของ React แทน)
 */
export default function GlobalError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="th">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 16,
          background: "#F6F3FB",
          color: "#2B2D3E",
          fontFamily: "'IBM Plex Sans Thai', 'Leelawadee UI', Tahoma, sans-serif",
        }}
      >
        <title>ขออภัย มีบางอย่างผิดพลาด</title>
        <main
          style={{
            maxWidth: 420,
            width: "100%",
            textAlign: "center",
            background: "#FFFFFF",
            borderRadius: 26,
            padding: "32px 20px",
            boxShadow: "0 16px 40px rgba(110, 90, 170, 0.10)",
          }}
        >
          <h1 style={{ fontSize: 22, margin: "0 0 8px", lineHeight: 1.4 }}>ขออภัย มีบางอย่างผิดพลาด</h1>
          <p style={{ margin: "0 0 20px", color: "#5F6178", lineHeight: 1.6 }}>ระบบสะดุดชั่วคราว ลองโหลดใหม่อีกครั้ง</p>
          <button
            type="button"
            onClick={() => retry()}
            style={{
              minHeight: 44,
              padding: "0 22px",
              borderRadius: 999,
              border: "1px solid #D9CCF9",
              background: "#EFE9FD",
              color: "#4B2FB0",
              fontWeight: 600,
              fontSize: 15,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            ลองใหม่อีกครั้ง
          </button>
        </main>
      </body>
    </html>
  );
}
