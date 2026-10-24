// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ContactContent } from "../contact-content";
import { HowToOrderContent } from "../how-to-order-content";

const storefront = {
  storeName: "ร้านเฮียชัยโมบาย",
  tagline: "ขายส่งอุปกรณ์มือถือ",
  ownerName: "เฮียชัย",
  assistantName: "ผู้ช่วย AI ของเฮียชัย",
  bankAccountName: "กสิกรไทย xxx-x-x5678-x ร้านเฮียชัยโมบาย",
  contactChannel: "LINE ร้านเฮียชัยโมบาย",
  orderRefPlaceholder: "[เลขออเดอร์]",
};

describe("วิธีสั่งซื้อ", () => {
  it("ขั้นตอนตรงกับระบบจริง: เลือกสินค้า → บอกจำนวน/ราคา → เลือกข้อเสนอ → ยืนยัน → โอนเข้าบัญชีร้าน", () => {
    render(<HowToOrderContent storefront={storefront} />);
    const steps = screen.getAllByRole("listitem").map((li) => li.textContent ?? "");
    expect(steps[0]).toContain("เลือกสินค้า");
    expect(steps.some((s) => s.includes("กสิกรไทย xxx-x-x5678-x ร้านเฮียชัยโมบาย"))).toBe(true);
    expect(steps.some((s) => s.includes("LINE ร้านเฮียชัยโมบาย"))).toBe(true);
    expect(screen.getByText(/24 ชั่วโมง/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "เริ่มแชตต่อราคา" })).toHaveAttribute("href", "/");
  });
});

describe("ติดต่อร้าน", () => {
  it("ชื่อร้าน เจ้าของ ช่องทางติดต่อ บัญชีรับโอน + ปุ่มคุยกับเถ้าแก่", () => {
    render(<ContactContent storefront={storefront} />);
    expect(screen.getByText("ร้านเฮียชัยโมบาย")).toBeInTheDocument();
    expect(screen.getByText("LINE ร้านเฮียชัยโมบาย")).toBeInTheDocument();
    expect(screen.getByText("กสิกรไทย xxx-x-x5678-x ร้านเฮียชัยโมบาย")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "คุยกับเฮียชัยโดยตรง" })).toBeEnabled();
  });
});
