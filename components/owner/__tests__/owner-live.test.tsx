// @vitest-environment jsdom
import { act, render, screen } from "@testing-library/react";
import { Activity } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OwnerLive, type ConnectLive } from "../owner-live";

// router ของ Next คงที่ตลอดอายุหน้า — ของปลอมต้องคงที่เหมือนกัน
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

function fakeConnect() {
  const handlers: { change?: () => void; status?: (s: "live" | "offline") => void } = {};
  const connect: ConnectLive = (onChange, onStatus) => {
    handlers.change = onChange;
    handlers.status = onStatus;
    return () => {};
  };
  return { connect, handlers };
}

describe("OwnerLive", () => {
  it("ต่อติด → มีออเดอร์ใหม่ก็โหลดตัวเลขใหม่ ไม่ขึ้นคำเตือน", () => {
    const { connect, handlers } = fakeConnect();
    render(<OwnerLive connect={connect} />);
    act(() => handlers.status!("live"));
    act(() => vi.advanceTimersByTime(400));
    refresh.mockClear();
    act(() => handlers.change!());
    act(() => vi.advanceTimersByTime(400));
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/หลุด/)).not.toBeInTheDocument();
  });

  it("ต่อติดครั้งแรก → ดึงหนึ่งครั้ง เผื่อมีอะไรเกิดระหว่างโหลดหน้ากับเริ่มฟัง", () => {
    const { connect, handlers } = fakeConnect();
    render(<OwnerLive connect={connect} />);
    act(() => handlers.status!("live"));
    act(() => vi.advanceTimersByTime(400));
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("ไปหน้าอื่นแล้วกลับมา (Next เก็บหน้าไว้ใน Activity) → ต่อใหม่แล้วดึงตัวเลขล่าสุด ไม่ค้างตัวเลขเก่า", () => {
    const { connect, handlers } = fakeConnect();
    const ui = (mode: "visible" | "hidden") => (
      <Activity mode={mode}>
        <OwnerLive connect={connect} />
      </Activity>
    );
    const { rerender } = render(ui("visible"));
    act(() => handlers.status!("live"));
    act(() => vi.advanceTimersByTime(400));
    refresh.mockClear();
    rerender(ui("hidden"));
    rerender(ui("visible"));
    act(() => handlers.status!("live"));
    act(() => vi.advanceTimersByTime(400));
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("เชื่อมต่อหลุด → บอกเถ้าแก่ และดึงตัวเลขใหม่ทุก 10 วินาที", () => {
    const { connect, handlers } = fakeConnect();
    render(<OwnerLive connect={connect} />);
    act(() => handlers.status!("offline"));
    expect(screen.getByRole("status")).toHaveTextContent("การเชื่อมต่อแบบสดหลุด · อัปเดตทุก 10 วินาที");
    act(() => vi.advanceTimersByTime(30_000));
    expect(refresh).toHaveBeenCalledTimes(3);
  });

  it("ต่อไม่ติดเลยภายใน 8 วินาที → ถือว่าหลุด เริ่มดึงเป็นรอบ", () => {
    const { connect } = fakeConnect();
    render(<OwnerLive connect={connect} />);
    act(() => vi.advanceTimersByTime(8_000));
    expect(screen.getByRole("status")).toHaveTextContent(/หลุด/);
    act(() => vi.advanceTimersByTime(10_000));
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("กลับมาต่อติด → หยุดดึงเป็นรอบ และดึงหนึ่งครั้งเผื่อพลาดระหว่างหลุด", () => {
    const { connect, handlers } = fakeConnect();
    render(<OwnerLive connect={connect} />);
    act(() => handlers.status!("offline"));
    act(() => handlers.status!("live"));
    act(() => vi.advanceTimersByTime(400));
    expect(refresh).toHaveBeenCalledTimes(1);
    act(() => vi.advanceTimersByTime(30_000));
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
