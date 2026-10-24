// @vitest-environment jsdom
import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ConnectLive } from "@/components/live/use-live-updates";
import { OrderLive } from "../order-live";

const { refresh, router } = vi.hoisted(() => {
  const refresh = vi.fn();
  return { refresh, router: { refresh } };
});
vi.mock("next/navigation", () => ({ useRouter: () => router }));
beforeEach(() => {
  vi.useFakeTimers();
  refresh.mockClear();
});
afterEach(() => vi.useRealTimers());

describe("OrderLive — ใบสรุปของลูกค้าเปลี่ยนเองเมื่อร้านยืนยันรับเงิน", () => {
  it("ออเดอร์ถูกแก้ (ร้านกดได้รับเงินแล้ว) → โหลดใบสรุปใหม่โดยลูกค้าไม่ต้องรีเฟรช", () => {
    let change: () => void = () => {};
    const connect: ConnectLive = (onChange) => {
      change = onChange;
      return () => {};
    };
    render(<OrderLive connect={connect} />);
    act(() => change());
    act(() => vi.advanceTimersByTime(400));
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
