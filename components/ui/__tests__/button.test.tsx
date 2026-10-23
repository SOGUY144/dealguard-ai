// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button, IconButton } from "../button";

describe("Button", () => {
  it("เป็น type=button โดยปริยาย ไม่ submit ฟอร์มโดยไม่ตั้งใจ", () => {
    render(<Button>ยืนยัน</Button>);
    expect(screen.getByRole("button", { name: "ยืนยัน" })).toHaveAttribute("type", "button");
  });

  it("ใช้คลาสกระจกตาม variant — ห้ามปุ่มม่วงทึบ", () => {
    render(
      <>
        <Button variant="primary">หลัก</Button>
        <Button variant="secondary">รอง</Button>
        <Button variant="chip">chip</Button>
      </>,
    );
    expect(screen.getByRole("button", { name: "หลัก" })).toHaveClass("btn-primary");
    expect(screen.getByRole("button", { name: "รอง" })).toHaveClass("btn-secondary");
    expect(screen.getByRole("button", { name: "chip" })).toHaveClass("chip");
  });
});

describe("IconButton", () => {
  it("ปุ่มไอคอนต้องมีชื่อให้ screen reader และกดได้ขนาด 44px", () => {
    render(<IconButton label="ปิดรายการสินค้า">x</IconButton>);
    const button = screen.getByRole("button", { name: "ปิดรายการสินค้า" });
    expect(button).toHaveClass("size-11");
  });
});
