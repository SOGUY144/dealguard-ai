import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  resolve: {
    // "server-only" โยน error เมื่อ import นอก React Server — ใน test ให้ใช้ไฟล์ว่างของแพ็กเกจแทน
    alias: {
      "server-only": fileURLToPath(new URL("./node_modules/server-only/empty.js", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    passWithNoTests: true,
  },
});
