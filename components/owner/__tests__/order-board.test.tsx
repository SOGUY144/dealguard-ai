// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MOCK_OFFERS } from "@/lib/chat/mock-offers";
import type { OwnerDeal } from "@/lib/owner/summary";
import { OrderBoard } from "../order-board";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const deal = (id: string, letter: 0 | 1 | 2, confirmedAt: string | null, paidAt: string | null): OwnerDeal => ({
  id,
  chatId: `chat-${id}`,
  at: "2026-10-24T03:00:00.000Z",
  buyerName: `ลูกค้า ${id}`,
  productName: "สายชาร์จ Type-C 1 เมตร",
  offer: MOCK_OFFERS[letter],
  marginIfConceded: 25_000,
  marginOffer: 45_000,
  recoveredMargin: 20_000,
  confirmedAt,
  paidAt,
});

const actions = {
  confirm: async () => ({ ok: true as const, confirmedAt: "2026-10-24T04:00:00.000Z" }),
  markPaid: async () => ({ ok: true as const, paidAt: null, confirmedAt: null }),
};

describe("OrderBoard — แท็บออเดอร์และชำระเงิน", () => {
  const board = {
    pending: [deal("p1", 0, null, null)],
    awaiting: [deal("w1", 1, "2026-10-24T03:10:00.000Z", null)],
    paid: [deal("d1", 2, "2026-10-24T03:10:00.000Z", "2026-10-24T05:00:00.000Z")],
  };

  it("แยก 3 กลุ่มตามสถานะ พร้อมจำนวน", () => {
    render(<OrderBoard board={board} {...actions} />);
    expect(screen.getByRole("heading", { level: 1, name: "ออเดอร์และชำระเงิน" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "รอยืนยัน 1 ออเดอร์" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "รอชำระ 1 ออเดอร์" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "ชำระแล้ววันนี้ 1 ออเดอร์" })).toBeInTheDocument();
  });

  it("ออเดอร์รอยืนยัน: ยืนยันได้ตรงนี้ · ไปดูแชต · เปิดใบสรุป/QR แบบที่ลูกค้าเห็น", () => {
    render(<OrderBoard board={board} {...actions} />);
    const card = within(screen.getByRole("region", { name: "รอยืนยัน 1 ออเดอร์" })).getByRole("listitem");
    expect(card).toHaveTextContent("ลูกค้า p1");
    expect(card).toHaveTextContent("฿130 × 1,500");
    expect(card).toHaveTextContent("฿195,000");
    expect(within(card).getByRole("button", { name: "ยืนยันออเดอร์ · ลูกค้า p1" })).toBeInTheDocument();
    expect(within(card).getByRole("link", { name: "ดูแชตของลูกค้า p1" })).toHaveAttribute("href", "/owner/chats/chat-p1");
    expect(within(card).getByRole("link", { name: "ใบสรุป / QR ของลูกค้า p1" })).toHaveAttribute("href", "/order/p1");
  });

  it("ออเดอร์เครดิต: บอกวันครบกำหนดจ่าย · จ่ายสด: บอกว่าชำระทันที", () => {
    render(<OrderBoard board={board} {...actions} />);
    // ข้อ A (MOCK) เครดิต 30 วัน นับจากวันที่ปิดดีล 24 ต.ค.
    expect(within(screen.getByRole("region", { name: "รอยืนยัน 1 ออเดอร์" })).getByText(/เครดิต 30 วัน · ครบ 23 พ.ย. 2569/)).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "รอชำระ 1 ออเดอร์" })).getByText(/โอนทันที/)).toBeInTheDocument();
  });

  it("กลุ่มที่ว่าง → บอกว่าไม่มี", () => {
    render(<OrderBoard board={{ pending: [], awaiting: [], paid: [] }} {...actions} />);
    expect(screen.getByText("ไม่มีออเดอร์รอยืนยัน")).toBeInTheDocument();
    expect(screen.getByText("ไม่มีออเดอร์รอชำระ")).toBeInTheDocument();
    expect(screen.getByText("วันนี้ยังไม่มีออเดอร์ที่ชำระแล้ว")).toBeInTheDocument();
  });
});
