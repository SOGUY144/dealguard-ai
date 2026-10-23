import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  resolve: {
    // "server-only" โยน error เมื่อ import นอก React Server — ใน test ให้ใช้ไฟล์ว่างของแพ็กเกจแทน
    alias: {
      "server-only": fileURLToPath(new URL("./node_modules/server-only/empty.js", import.meta.url)),
    },
  },
  test: {
    // logic ล้วนรันใน node; test ของ component ใส่ `// @vitest-environment jsdom` บนสุดของไฟล์
    environment: "node",
    setupFiles: ["./vitest.setup.ts"],
    // test ที่ยิง Supabase จริงรันแยกด้วย npm run test:db
    exclude: ["**/node_modules/**", "tests/db/**"],
    passWithNoTests: true,
  },
});
