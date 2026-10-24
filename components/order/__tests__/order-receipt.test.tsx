// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { getMockOrder } from "@/lib/chat/mock-orders";
import type { Storefront } from "@/lib/chat/types";
import { OrderReceipt } from "../order-receipt";

const storefront: Storefront = {
  storeName: "ร้านเฮียชัยโมบาย",
  tagline: "ขายส่งอุปกรณ์มือถือ",
  ownerName: "เฮียชัย",
  assistantName: "ผู้ช่วย AI ของเฮียชัย",
  bankAccountName: "[ชื่อบัญชีร้าน]",
  contactChannel: "[ช่องทางติดต่อของร้าน]",
  orderRefPlaceholder: "[เลขออเดอร์]",
};

describe("getMockOrder", () => {
  it("มีออเดอร์เดโมของทั้ง 3 ข้อเสนอ", () => {
    expect(getMockOrder("demo-A")?.offer.id).toBe("A");
    expect(getMockOrder("demo-C")?.offer.lever).toBe("bundle");
    expect(getMockOrder("nope")).toBeUndefined();
  });
});

describe("OrderReceipt (Mobile-Order)", () => {
  it("ใบสรุปครบทุกแถวตามดีไซน์", () => {
    render(<OrderReceipt order={getMockOrder("demo-A")!} storefront={storefront} />);
    expect(screen.getByRole("heading", { level: 1, name: "สรุปออเดอร์" })).toBeInTheDocument();
    expect(screen.getByText("ส่งออเดอร์ให้ร้านแล้ว")).toBeInTheDocument();
    expect(screen.getByText("ร้านเฮียชัยโมบาย · 21:33")).toBeInTheDocument();
    expect(screen.getByText("สายชาร์จ Type-C 1 เมตร")).toBeInTheDocument();
    expect(screen.getByText("A · ซื้อเยอะ")).toBeInTheDocument();
    expect(screen.getByText("1,500 × ฿130")).toBeInTheDocument();
    expect(screen.getByText("เครดิต 30 วัน")).toBeInTheDocument();
    expect(screen.getByText("฿195,000")).toBeInTheDocument();
    // ร้านไม่มี LINE ของลูกค้า — เถ้าแก่ยืนยันได้ทางแชตเท่านั้น ลูกค้าทักร้านเองได้
    expect(screen.getByText("เฮียชัยจะยืนยันวันส่งของในแชต หรือทักร้านทาง [ช่องทางติดต่อของร้าน]")).toBeInTheDocument();
    expect(screen.getByText(/รับโอนเข้าบัญชี \[ชื่อบัญชีร้าน\] เท่านั้น/)).toBeInTheDocument();
  });

  it("กลับไปแชตได้ทั้งปุ่มบนและปุ่มล่าง", () => {
    render(<OrderReceipt order={getMockOrder("demo-B")!} storefront={storefront} />);
    const links = screen.getAllByRole("link", { name: "กลับไปแชต" });
    expect(links).toHaveLength(2);
    for (const link of links) expect(link).toHaveAttribute("href", "/");
  });

  it("ปุ่มคุยกับเถ้าแก่กดได้ (ส่งเรื่องให้เถ้าแก่แล้วกลับไปแชต)", () => {
    render(<OrderReceipt order={getMockOrder("demo-B")!} storefront={storefront} />);
    expect(screen.getByRole("button", { name: "คุยกับเฮียชัยโดยตรง" })).toBeEnabled();
  });
});
