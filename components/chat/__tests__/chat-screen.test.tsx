// @vitest-environment jsdom
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Storefront } from "@/lib/chat/types";
import { ChatScreen } from "../chat-screen";

const storefront: Storefront = {
  storeName: "ร้านเฮียชัยโมบาย",
  tagline: "ขายส่งอุปกรณ์มือถือ",
  ownerName: "เฮียชัย",
  assistantName: "ผู้ช่วย AI ของเฮียชัย",
  bankAccountName: "[ชื่อบัญชีร้าน]",
  contactChannel: "[ช่องทางติดต่อของร้าน]",
  orderRefPlaceholder: "[เลขออเดอร์]",
};
const products = [{ sku: "CBL-C-1M", name: "สายชาร์จ Type-C 1 เมตร", listPrice: 150 }];

function setViewport(desktop: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: desktop,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

function renderScreen(props: Partial<Parameters<typeof ChatScreen>[0]> = {}) {
  return render(<ChatScreen storefront={storefront} products={products} buyerName="คุณนก" {...props} />);
}

const thread = () => screen.getByRole("log");

afterEach(() => {
  vi.useRealTimers();
});

describe("ChatScreen — คอม", () => {
  it("เปิด drawer สินค้าไว้ตั้งแต่แรก กดขอต่อราคาแล้วการ์ดสินค้าเข้าแชต", () => {
    setViewport(true);
    renderScreen();
    const drawer = screen.getByRole("complementary", { name: "สินค้าในร้าน" });
    fireEvent.click(within(drawer).getByRole("button", { name: "ขอต่อราคา" }));

    expect(within(thread()).getByRole("article", { name: "สายชาร์จ Type-C 1 เมตร" })).toBeInTheDocument();
    expect(within(thread()).getByText(/ต้องการกี่ชิ้น/)).toBeInTheDocument();
    expect(within(drawer).getByRole("button", { name: "กำลังต่อราคาในแชต" })).toBeInTheDocument();
  });

  it("ต่อราคาครบ flow: chip → 3 ข้อเสนอ → เลือก B → ยืนยัน → ใบสรุป", () => {
    setViewport(true);
    renderScreen({ scenario: "product" });
    fireEvent.click(screen.getByRole("button", { name: /ขอ 125 ได้ไหมคะ/ }));

    const group = within(thread()).getByRole("group", { name: "3 ทางเลือกจากเฮียชัย" });
    // พิมพ์มา (chip = ข้อความ) → ตอบเป็นข้อความ ไม่มีเสียง
    expect(screen.queryByRole("button", { name: "เล่นข้อความเสียง" })).not.toBeInTheDocument();

    fireEvent.click(within(group).getAllByRole("button")[1]);
    fireEvent.click(screen.getByRole("button", { name: "ยืนยันข้อ B · ฿135,000" }));

    expect(within(thread()).getByText("เลือกข้อ B · จ่ายสด")).toBeInTheDocument();
    expect(within(thread()).getByText("ส่งออเดอร์ให้ร้านแล้วครับ")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ต่อราคาสินค้าอื่น" })).toBeInTheDocument();
  });

  it("ปุ่มสินค้าปิด/เปิด drawer", () => {
    setViewport(true);
    renderScreen();
    fireEvent.click(screen.getByRole("button", { name: "สินค้า" }));
    expect(screen.queryByRole("complementary", { name: "สินค้าในร้าน" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "สินค้า" }));
    expect(screen.getByRole("complementary", { name: "สินค้าในร้าน" })).toBeInTheDocument();
  });

  it("แถบชื่อร้านบนคอม", () => {
    setViewport(true);
    renderScreen();
    expect(screen.getByRole("navigation", { name: "เมนูร้าน" })).toBeInTheDocument();
    expect(screen.getByText("ร้านเฮียชัยโมบาย")).toBeInTheDocument();
  });
});

describe("ChatScreen — มือถือ", () => {
  it("กดสินค้า → bottom sheet เลือกแล้วปิดเอง", () => {
    setViewport(false);
    renderScreen();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "สินค้า" }));
    const sheet = screen.getByRole("dialog", { name: "สินค้าในร้าน" });
    fireEvent.click(within(sheet).getByRole("button", { name: "ต่อราคา" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(within(thread()).getByRole("article", { name: "สายชาร์จ Type-C 1 เมตร" })).toBeInTheDocument();
  });

  it("ตอน sheet เปิด เนื้อหาข้างหลังกดไม่ได้ (inert) และปิดแล้วโฟกัสกลับปุ่มเดิม", () => {
    setViewport(false);
    renderScreen();
    const trigger = screen.getByRole("button", { name: "สินค้า" });
    trigger.focus();
    fireEvent.click(trigger);

    expect(screen.getByRole("main", { hidden: true })).toHaveAttribute("inert");
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });

    expect(screen.getByRole("main")).not.toHaveAttribute("inert");
    expect(trigger).toHaveFocus();
  });

  it("กดไมค์พูด → กำลังอัด → กดส่ง → กำลังแปลงเสียง → AI ตอบเป็นเสียง", () => {
    vi.useFakeTimers();
    setViewport(false);
    renderScreen({ scenario: "product" });

    fireEvent.click(screen.getByRole("button", { name: "พูดด้วยเสียง" }));
    expect(screen.getByRole("status")).toHaveTextContent("กำลังอัดเสียง");

    fireEvent.click(screen.getByRole("button", { name: "หยุดและส่งเสียง" }));
    expect(screen.getByRole("status")).toHaveTextContent("กำลังแปลงเสียงเป็นข้อความ");

    act(() => vi.advanceTimersByTime(1500));
    expect(within(thread()).getByText("ส่งด้วยเสียง")).toBeInTheDocument();
    expect(within(thread()).getByRole("button", { name: "เล่นข้อความเสียง" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "พูดด้วยเสียง" })).toBeEnabled();
  });

  it("คุยกับคนจริง → การ์ดส่งเรื่อง และช่องพิมพ์ถึงเถ้าแก่", () => {
    setViewport(false);
    renderScreen();
    fireEvent.click(screen.getByRole("button", { name: "คุยกับคนจริง" }));
    expect(within(thread()).getByText("ส่งเรื่องให้เฮียชัยแล้ว")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "พิมพ์ข้อความ" })).toHaveAttribute("placeholder", "พิมพ์ข้อความถึงเฮียชัย");
  });

  it("เปิดจาก scenario ได้ (เช่น guard)", () => {
    setViewport(false);
    renderScreen({ scenario: "guard" });
    expect(within(thread()).getByText("ราคาล็อกโดยระบบของร้าน")).toBeInTheDocument();
  });

  it("chip 'สั่ง 1,500 ชิ้น' = เลือกข้อเสนอ A ที่มีอยู่ ไม่ใช่ต่อราคาใหม่", () => {
    setViewport(false);
    Element.prototype.scrollIntoView = vi.fn();
    renderScreen({ scenario: "guard" });
    const before = within(thread()).getAllByRole("group").length;
    fireEvent.click(screen.getByRole("button", { name: "สั่ง 1,500 ชิ้น" }));

    const group = within(thread()).getByRole("group", { name: "3 ทางเลือกจากเฮียชัย" });
    expect(within(group).getAllByRole("button")[0]).toHaveAttribute("aria-pressed", "true");
    expect(within(thread()).getAllByRole("group")).toHaveLength(before);
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
  });
});
