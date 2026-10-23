import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const BACK_OFFICE = "ห้าม import ข้อมูลหลังบ้าน (ต้นทุน/ราคาพื้น/service role) ในโค้ดฝั่ง browser — ส่งเป็น props จาก server แทน";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // สกิลที่ติดตั้งจากภายนอก และไฟล์ดีไซน์อ้างอิง — ไม่ใช่โค้ดของแอป
    ".claude/**",
    "design/**",
  ]),
  {
    // โค้ดที่ไปถึง browser ได้ ห้าม import ต้นทุน/ราคาพื้น หรือ service role (SKILL §6.8)
    // ข้อมูลที่ลูกค้าเห็นได้ต้องส่งเป็น props จาก server (lib/config/storefront.ts)
    files: [
      "components/**/*.{ts,tsx}",
      "lib/chat/**/*.{ts,tsx}",
      "lib/owner/summary.ts",
      "lib/supabase/client.ts",
      "lib/format.ts",
      "lib/use-media-query.ts",
    ],
    ignores: ["**/__tests__/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            // ตัว index ของ engine / chat-server ทั้งแบบ alias และ path สัมพัทธ์ ("../../lib/deal-engine")
            // ใช้ regex เพราะ gitignore pattern ห้ามทั้งโฟลเดอร์แล้วยกเว้น types คืนไม่ได้
            { regex: "(^|/)(deal-engine|chat-server)$", message: BACK_OFFICE },
            {
              // รวมแบบ path สัมพัทธ์ด้วย (../deal-engine/engine)
              group: [
                "**/merchant.json",
                "**/config/*",
                "**/supabase/admin",
                "**/chat-server/*",
                "**/owner/dashboard",
                "**/deal-engine/*",
                "!**/deal-engine/types",
              ],
              message: BACK_OFFICE,
            },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;
