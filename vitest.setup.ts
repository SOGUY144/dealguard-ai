import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// component test ไม่ได้อยู่ใน App Router ของ Next — ใช้ router ปลอมแทน
// router ของ Next คงที่ตลอดอายุหน้า — ของปลอมต้องคงที่ด้วย ไม่งั้น effect ที่ขึ้นกับ router รันใหม่ทุก render
const router = { push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), forward: vi.fn(), prefetch: vi.fn() };
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  useRouter: () => router,
}));

afterEach(() => {
  cleanup();
});
