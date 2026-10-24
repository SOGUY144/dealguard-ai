// @vitest-environment jsdom
import { act, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { canAnimateBackground, MovingBackground } from "../moving-background";

type Env = { reducedMotion?: boolean; desktop?: boolean; webgl?: boolean };

function setup({ reducedMotion = false, desktop = true, webgl = true }: Env = {}) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: query.includes("prefers-reduced-motion") ? reducedMotion : query.includes("min-width") ? desktop : false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(((type: string) =>
    webgl && type.startsWith("webgl") ? ({} as RenderingContext) : null) as typeof HTMLCanvasElement.prototype.getContext);
}

afterEach(() => vi.restoreAllMocks());

describe("พื้นหลังเคลื่อนไหว — เปิดเฉพาะที่ไม่รบกวนผู้ใช้", () => {
  it("จอคอม + ไม่ได้ตั้งลดการเคลื่อนไหว + มี WebGL → เปิด", () => {
    setup();
    expect(canAnimateBackground(window)).toBe(true);
  });

  it("ผู้ใช้ตั้ง 'ลดการเคลื่อนไหว' ในเครื่อง → ไม่เปิด (ใช้ mesh เดิม)", () => {
    setup({ reducedMotion: true });
    expect(canAnimateBackground(window)).toBe(false);
  });

  it("มือถือ / จอแคบ → ไม่เปิด (ประหยัดแบตและเครื่องไม่ร้อน)", () => {
    setup({ desktop: false });
    expect(canAnimateBackground(window)).toBe(false);
  });

  it("เครื่องไม่มี WebGL → ไม่เปิด", () => {
    setup({ webgl: false });
    expect(canAnimateBackground(window)).toBe(false);
  });

  it("ไม่เปิด → ไม่โหลดตัววาดภาพเลย (หน้าไม่หนักขึ้น)", async () => {
    setup({ reducedMotion: true });
    const load = vi.fn(() => new Promise<never>(() => {}));
    const { container } = render(<MovingBackground load={load} />);
    await act(async () => {});
    expect(load).not.toHaveBeenCalled();
    expect(container).toBeEmptyDOMElement();
  });

  it("ตัววาดภาพพัง (เช่น WebGL หลุด) → หน้าไม่พัง เหลือ mesh เดิม", async () => {
    setup();
    vi.spyOn(console, "error").mockImplementation(() => {});
    const Broken = () => {
      throw new Error("WebGL context lost");
    };
    const { container } = render(<MovingBackground load={async () => Broken} />);
    await act(async () => {});
    await act(async () => {});
    expect(container).toBeEmptyDOMElement();
  });
});
