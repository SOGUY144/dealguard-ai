// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { welcomeStore } from "@/lib/welcome/store";
import { COVER_MS, HARD_NAV_AFTER, LEAVE_MS, MIN_END, NAVIGATE_AT, STEPS, WelcomeCutscene } from "../welcome-cutscene";

const nav = vi.hoisted(() => ({ pathname: "/login", replace: vi.fn() }));
vi.mock("next/navigation", () => ({
  usePathname: () => nav.pathname,
  useRouter: () => ({ replace: nav.replace }),
}));

function setReducedMotion(reduce: boolean) {
  window.matchMedia = vi.fn((query: string) => ({
    matches: reduce && query.includes("reduce"),
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

const buyer = { to: "/", name: "นก", role: "buyer" as const };

/** จำลองว่าหน้าปลายทางมาแล้ว (path เปลี่ยน) แล้ว render ใหม่ */
function arrive(rerender: (ui: React.ReactElement) => void, path = "/") {
  nav.pathname = path;
  rerender(<WelcomeCutscene storeName="ร้านเฮียชัยโมบาย" />);
}

beforeEach(() => {
  vi.useFakeTimers();
  nav.pathname = "/login";
  nav.replace.mockClear();
  setReducedMotion(false);
});
afterEach(() => {
  act(() => welcomeStore.finish());
  vi.useRealTimers();
});

describe("คัตซีนต้อนรับหลังล็อกอิน", () => {
  it("ยังไม่ได้ล็อกอิน → ไม่แสดงอะไร", () => {
    const { container } = render(<WelcomeCutscene storeName="ร้านเฮียชัยโมบาย" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("เล่นเรื่องตามจังหวะ: ทักชื่อ → คุยกับลูกค้า → ปิดดีล แล้วค่อยพาไปหน้าปลายทาง", () => {
    render(<WelcomeCutscene storeName="ร้านเฮียชัยโมบาย" />);
    act(() => welcomeStore.play(buyer));

    expect(screen.getByRole("dialog", { name: "ยินดีต้อนรับ คุณนก" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ข้าม" })).toHaveFocus();
    expect(screen.getByText("ขอ ฿125 ได้ไหมครับ 1,000 ชิ้น")).toHaveAttribute("data-show", "false");

    act(() => vi.advanceTimersByTime(STEPS.ask));
    expect(screen.getByText("ขอ ฿125 ได้ไหมครับ 1,000 ชิ้น")).toHaveAttribute("data-show", "true");
    expect(screen.getByText("เอาข้อ B ครับ")).toHaveAttribute("data-show", "false");
    expect(nav.replace).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(NAVIGATE_AT - STEPS.ask));
    expect(screen.getByText("ปิดดีลแล้ว").parentElement).toHaveAttribute("data-show", "true");
    // ฉลองปิดดีล: กระดาษสีพุ่งจากเครื่องหมายถูก
    expect(document.querySelector(".cs-deal .confetti")).toBeInTheDocument();
    expect(nav.replace).toHaveBeenCalledExactlyOnceWith("/");
  });

  it("หน้าใหม่มาแล้วแต่เรื่องยังไม่จบ → รอจนจบ แล้วจางออก", () => {
    const { rerender } = render(<WelcomeCutscene storeName="ร้านเฮียชัยโมบาย" />);
    act(() => welcomeStore.play(buyer));
    act(() => vi.advanceTimersByTime(NAVIGATE_AT));
    arrive(rerender);

    expect(screen.getByRole("dialog")).toHaveAttribute("data-phase", "play");
    act(() => vi.advanceTimersByTime(MIN_END - NAVIGATE_AT));
    // ทางออกผ่านก้อนเมฆ: เมฆปิดจอก่อน แล้วค่อยแยกออกให้เห็นหน้าใหม่
    expect(screen.getByRole("dialog")).toHaveAttribute("data-phase", "cover");
    act(() => vi.advanceTimersByTime(COVER_MS));
    expect(screen.getByRole("dialog")).toHaveAttribute("data-phase", "reveal");
    act(() => vi.advanceTimersByTime(LEAVE_MS - COVER_MS));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(welcomeStore.get()).toBeNull();
  });

  it("กดข้าม → พาไปทันที และจางออกเมื่อหน้าใหม่มา", () => {
    const { rerender } = render(<WelcomeCutscene storeName="ร้านเฮียชัยโมบาย" />);
    act(() => welcomeStore.play({ ...buyer, to: "/owner", role: "owner" }));
    fireEvent.click(screen.getByRole("button", { name: "ข้าม" }));
    expect(nav.replace).toHaveBeenCalledExactlyOnceWith("/owner");

    arrive(rerender, "/owner");
    expect(screen.getByRole("dialog")).toHaveAttribute("data-phase", "cover");
    act(() => vi.advanceTimersByTime(LEAVE_MS));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("Esc = ข้าม", () => {
    render(<WelcomeCutscene storeName="ร้านเฮียชัยโมบาย" />);
    act(() => welcomeStore.play(buyer));
    fireEvent.keyDown(window, { key: "Escape" });
    expect(nav.replace).toHaveBeenCalledExactlyOnceWith("/");
  });

  it("เถ้าแก่ได้คำทักคนละแบบกับลูกค้า", () => {
    render(<WelcomeCutscene storeName="ร้านเฮียชัยโมบาย" />);
    act(() => welcomeStore.play({ to: "/owner", name: "เฮียชัย", role: "owner" }));
    expect(screen.getByText("วันนี้ผมช่วยตอบแชตลูกค้าแทนเถ้าแก่นะครับ")).toBeInTheDocument();
  });

  it("ตั้งค่าลดการเคลื่อนไหว → ไม่เล่นคัตซีน พาไปเลย", () => {
    setReducedMotion(true);
    const { rerender } = render(<WelcomeCutscene storeName="ร้านเฮียชัยโมบาย" />);
    act(() => welcomeStore.play(buyer));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(nav.replace).toHaveBeenCalledExactlyOnceWith("/");
    arrive(rerender);
    expect(welcomeStore.get()).toBeNull();
  });

  it("หน้าใหม่ไม่มาสักที → เปิดหน้าใหม่แบบเต็มหน้า ไม่ค้างในคัตซีน", () => {
    const assign = vi.fn();
    const original = window.location;
    Object.defineProperty(window, "location", { configurable: true, value: { ...original, assign } });
    try {
      render(<WelcomeCutscene storeName="ร้านเฮียชัยโมบาย" />);
      act(() => welcomeStore.play(buyer));
      act(() => vi.advanceTimersByTime(HARD_NAV_AFTER));
      expect(assign).toHaveBeenCalledWith("/");
    } finally {
      Object.defineProperty(window, "location", { configurable: true, value: original });
    }
  });

  it("คัตซีนพัง → ไม่ลากทั้งเว็บล่ม แต่พาไปหน้าปลายทางเลย", () => {
    const assign = vi.fn();
    const original = window.location;
    Object.defineProperty(window, "location", { configurable: true, value: { ...original, assign } });
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    window.matchMedia = (() => {
      throw new Error("matchMedia พัง");
    }) as unknown as typeof window.matchMedia;
    try {
      render(<WelcomeCutscene storeName="ร้านเฮียชัยโมบาย" />);
      act(() => welcomeStore.play(buyer));
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(assign).toHaveBeenCalledWith("/");
      expect(welcomeStore.get()).toBeNull();
    } finally {
      error.mockRestore();
      Object.defineProperty(window, "location", { configurable: true, value: original });
    }
  });

  it("ระหว่างคัตซีนล็อกการเลื่อนหน้า แล้วคืนค่าเมื่อจบ", () => {
    const { rerender } = render(<WelcomeCutscene storeName="ร้านเฮียชัยโมบาย" />);
    act(() => welcomeStore.play(buyer));
    expect(document.documentElement.style.overflow).toBe("hidden");
    fireEvent.click(screen.getByRole("button", { name: "ข้าม" }));
    arrive(rerender);
    act(() => vi.advanceTimersByTime(LEAVE_MS));
    expect(document.documentElement.style.overflow).toBe("");
  });
});
