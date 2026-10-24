// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OrderActions } from "../order-actions";

const { refresh, router } = vi.hoisted(() => {
  const refresh = vi.fn();
  return { refresh, router: { refresh } };
});
vi.mock("next/navigation", () => ({ useRouter: () => router }));
beforeEach(() => refresh.mockClear());

const markPaid = vi.fn(async () => ({ ok: true as const, paidAt: "2026-10-25T04:00:00.000Z", confirmedAt: "2026-10-25T03:15:00.000Z" }));

describe("OrderActions — ลูกค้าปิดดีลแล้ว เถ้าแก่ยืนยันออเดอร์ แล้วกดได้รับเงิน", () => {
  it("รอยืนยัน → กด 'ยืนยันออเดอร์' → บันทึก เปลี่ยนเป็นรอชำระ และโหลดหน้าใหม่", async () => {
    const confirm = vi.fn(async () => ({ ok: true as const, confirmedAt: "2026-10-25T03:15:00.000Z" }));
    render(<OrderActions orderId="o1" buyerName="คุณนก" confirmedAt={null} paidAt={null} confirm={confirm} markPaid={markPaid} />);
    expect(screen.getByText("รอยืนยัน")).toBeInTheDocument();
    // ยังไม่ยืนยัน → ยังไม่มีปุ่มได้รับเงิน (ทีละขั้น)
    expect(screen.queryByRole("button", { name: /ได้รับเงินแล้ว/ })).not.toBeInTheDocument();
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "ยืนยันออเดอร์ · คุณนก" })));
    expect(confirm).toHaveBeenCalledWith("o1");
    expect(screen.getByText("รอชำระ")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ได้รับเงินแล้ว · คุณนก" })).toBeInTheDocument();
    expect(refresh).toHaveBeenCalled();
  });

  it("บันทึกไม่สำเร็จ → บอกให้ลองใหม่ สถานะยังเป็นรอยืนยัน", async () => {
    const confirm = vi.fn(async () => ({ ok: false as const, error: "บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง" }));
    render(<OrderActions orderId="o1" buyerName="คุณนก" confirmedAt={null} paidAt={null} confirm={confirm} markPaid={markPaid} />);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "ยืนยันออเดอร์ · คุณนก" })));
    expect(screen.getByRole("alert")).toHaveTextContent("บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง");
    expect(screen.getByText("รอยืนยัน")).toBeInTheDocument();
  });

  it("ยืนยันแล้ว → ใช้ปุ่มได้รับเงินแล้วแบบเดิม", () => {
    render(
      <OrderActions
        orderId="o1"
        buyerName="คุณนก"
        confirmedAt="2026-10-25T03:15:00.000Z"
        paidAt={null}
        confirm={vi.fn()}
        markPaid={markPaid}
      />,
    );
    expect(screen.getByText("รอชำระ")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ได้รับเงินแล้ว · คุณนก" })).toBeInTheDocument();
  });

  it("ชำระแล้ว (ข้อมูลเก่าที่ไม่มีเวลายืนยัน) → ขึ้นชำระแล้ว ไม่ถามให้ยืนยันอีก", () => {
    render(
      <OrderActions orderId="o1" buyerName="คุณนก" confirmedAt={null} paidAt="2026-10-25T03:15:00.000Z" confirm={vi.fn()} markPaid={markPaid} />,
    );
    expect(screen.getByText("ชำระแล้ว 10:15")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /ยืนยันออเดอร์/ })).not.toBeInTheDocument();
  });
});
