// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PaidToggle } from "../paid-toggle";

const { refresh, router } = vi.hoisted(() => {
  const refresh = vi.fn();
  return { refresh, router: { refresh } };
});
vi.mock("next/navigation", () => ({ useRouter: () => router }));
beforeEach(() => refresh.mockClear());

describe("PaidToggle — เถ้าแก่ยืนยันว่าได้รับเงินแล้ว", () => {
  it("รอชำระ → กด 'ได้รับเงินแล้ว' → บันทึก ขึ้น 'ชำระแล้ว' และโหลดหน้าใหม่", async () => {
    const markPaid = vi.fn(async () => ({ ok: true as const, paidAt: "2026-10-25T03:15:00.000Z", confirmedAt: "2026-10-25T03:00:00.000Z" }));
    render(<PaidToggle orderId="o1" buyerName="คุณนก" paidAt={null} markPaid={markPaid} />);
    expect(screen.getByText("รอชำระ")).toBeInTheDocument();
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "ได้รับเงินแล้ว · คุณนก" })));
    expect(markPaid).toHaveBeenCalledWith("o1", true);
    expect(screen.getByText(/ชำระแล้ว/)).toBeInTheDocument();
    expect(refresh).toHaveBeenCalled();
  });

  it("บันทึกไม่สำเร็จ → บอกให้ลองใหม่ สถานะยังเป็นรอชำระ", async () => {
    const markPaid = vi.fn(async () => ({ ok: false as const, error: "บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง" }));
    render(<PaidToggle orderId="o1" buyerName="คุณนก" paidAt={null} markPaid={markPaid} />);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "ได้รับเงินแล้ว · คุณนก" })));
    expect(screen.getByRole("alert")).toHaveTextContent("บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง");
    expect(screen.getByText("รอชำระ")).toBeInTheDocument();
  });

  it("ชำระแล้ว → บอกเวลาที่ยืนยัน · กดผิดยกเลิกได้", async () => {
    const markPaid = vi.fn(async () => ({ ok: true as const, paidAt: null, confirmedAt: "2026-10-25T03:00:00.000Z" }));
    render(<PaidToggle orderId="o1" buyerName="คุณนก" paidAt="2026-10-25T03:15:00.000Z" markPaid={markPaid} />);
    expect(screen.getByText("ชำระแล้ว 10:15")).toBeInTheDocument();
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "ยกเลิกสถานะชำระแล้ว · คุณนก" })));
    expect(markPaid).toHaveBeenCalledWith("o1", false);
    expect(screen.getByText("รอชำระ")).toBeInTheDocument();
  });
});
