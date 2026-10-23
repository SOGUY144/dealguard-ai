// test ที่ยิง Supabase จริง (RLS) — รันแยกด้วย npm run test:db เพราะต้องต่อเน็ตและสร้างผู้ใช้ชั่วคราว
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  resolve: {
    alias: {
      "server-only": fileURLToPath(new URL("./node_modules/server-only/empty.js", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/db/**/*.db.test.ts"],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    // test แต่ละไฟล์สร้าง/ลบผู้ใช้ — รันทีละไฟล์กันชนกัน
    fileParallelism: false,
  },
});
