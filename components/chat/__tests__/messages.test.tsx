// @vitest-environment jsdom
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MOCK_OFFERS } from "@/lib/chat/mock-offers";
import { HandoffCard } from "../handoff-card";
import { OfferList } from "../offer-list";
import { OrderSummaryCard } from "../order-summary-card";
import { SystemNotice } from "../system-notice";
import { VoiceBubble } from "../voice-bubble";

describe("OfferList", () => {
  const renderList = (props: Partial<Parameters<typeof OfferList>[0]> = {}) => {
    const onSelect = vi.fn();
    const onConfirm = vi.fn();
    render(
      <OfferList
        offers={MOCK_OFFERS}
        ownerName="เฮียชัย"
        onSelect={onSelect}
        onConfirm={onConfirm}
        {...props}
      />,
    );
    return { onSelect, onConfirm, group: screen.getByRole("group", { name: "3 ทางเลือกจากเฮียชัย" }) };
  };

  it("แสดง 3 ข้อเสนอเป็นปุ่มที่บอกสถานะเลือก (aria-pressed)", () => {
    const { group } = renderList();
    const buttons = within(group).getAllByRole("button");
    expect(buttons).toHaveLength(3);
    for (const b of buttons) expect(b).toHaveAttribute("aria-pressed", "false");
    expect(buttons[0]).toHaveTextContent("ซื้อเยอะ");
    expect(buttons[0]).toHaveTextContent("฿130");
    expect(buttons[0]).toHaveTextContent("เมื่อสั่ง 1,500 ชิ้น");
    expect(buttons[0]).toHaveTextContent("฿195,000");
  });

  it("กดข้อเสนอ → แจ้ง id ที่เลือก", () => {
    const { group, onSelect } = renderList();
    fireEvent.click(within(group).getAllByRole("button")[1]);
    expect(onSelect).toHaveBeenCalledWith("B");
  });

  it("ยังไม่เลือก → ไม่มีปุ่มยืนยัน", () => {
    renderList();
    expect(screen.queryByRole("button", { name: /ยืนยันข้อ/ })).not.toBeInTheDocument();
  });

  it("เลือกแล้ว → ปุ่ม 'ยืนยันข้อ A · ฿195,000'", () => {
    const { onConfirm, group } = renderList({ selectedId: "A" });
    expect(within(group).getAllByRole("button")[0]).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "ยืนยันข้อ A · ฿195,000" }));
    expect(onConfirm).toHaveBeenCalled();
  });

  it("ยืนยันแล้ว → ล็อกข้อเสนอ ไม่มีปุ่มยืนยัน", () => {
    const { group, onSelect } = renderList({ selectedId: "A", confirmed: true });
    for (const b of within(group).getAllByRole("button")) expect(b).toBeDisabled();
    fireEvent.click(within(group).getAllByRole("button")[2]);
    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: /ยืนยันข้อ/ })).not.toBeInTheDocument();
  });
});

describe("VoiceBubble", () => {
  it("กดเล่น → เปลี่ยนเป็นปุ่มหยุด แล้วกลับเป็นเล่นเมื่อจบ", () => {
    vi.useFakeTimers();
    render(<VoiceBubble durationSec={14} />);
    expect(screen.getByText("0:14")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "เล่นข้อความเสียง" }));
    expect(screen.getByRole("button", { name: "หยุดข้อความเสียง" })).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(14_000));
    expect(screen.getByRole("button", { name: "เล่นข้อความเสียง" })).toBeInTheDocument();
    vi.useRealTimers();
  });
});

describe("OrderSummaryCard", () => {
  it("สรุปออเดอร์ + เตือนเรื่องบัญชีโอน + ลิงก์ไปใบสรุป", () => {
    render(
      <OrderSummaryCard
        orderId="demo-A"
        offer={MOCK_OFFERS[0]}
        productName="สายชาร์จ Type-C 1 เมตร"
        bankAccountName="[ชื่อบัญชีร้าน]"
      />,
    );
    expect(screen.getByText("ส่งออเดอร์ให้ร้านแล้วครับ")).toBeInTheDocument();
    expect(screen.getByText("1,500 × ฿130")).toBeInTheDocument();
    expect(screen.getByText("เครดิต 30 วัน")).toBeInTheDocument();
    expect(screen.getByText("฿195,000")).toBeInTheDocument();
    expect(screen.getByText(/รับโอนเข้าบัญชี \[ชื่อบัญชีร้าน\] เท่านั้น/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "ดูใบสรุปออเดอร์" })).toHaveAttribute("href", "/order/demo-A");
  });

  it("ข้อเสนอของแถม → ใบสรุปบอกของแถมด้วย", () => {
    render(<OrderSummaryCard orderId="demo-C" offer={MOCK_OFFERS[2]} productName="x" bankAccountName="y" />);
    expect(screen.getByText("หัวชาร์จ 20W 200 ชิ้น")).toBeInTheDocument();
  });

  it("คำเตือนเรื่องบัญชีโอนแสดงทุกขนาดจอ (ไม่ซ่อนบนมือถือ)", () => {
    render(<OrderSummaryCard orderId="demo-A" offer={MOCK_OFFERS[0]} productName="x" bankAccountName="[ชื่อบัญชีร้าน]" />);
    expect(screen.getByText(/รับโอนเข้าบัญชี/)).not.toHaveClass("hidden");
  });

  it("จ่ายสด → แสดง 'โอนทันที'", () => {
    render(<OrderSummaryCard orderId="demo-B" offer={MOCK_OFFERS[1]} productName="x" bankAccountName="y" />);
    expect(screen.getByText("โอนทันที")).toBeInTheDocument();
  });
});

describe("HandoffCard", () => {
  it("บอกลูกค้าว่าส่งเรื่องให้เถ้าแก่แล้ว และ AI จะไม่รับปากแทน", () => {
    render(
      <HandoffCard
        ownerName="เฮียชัย"
        subject="ขอคืนเงิน · ของเสีย 50 ชิ้น"
        orderRef="[เลขออเดอร์]"
        contactChannel="[ช่องทางติดต่อของร้าน]"
      />,
    );
    expect(screen.getByText("ส่งเรื่องให้เฮียชัยแล้ว")).toBeInTheDocument();
    expect(screen.getByText("รอเฮียชัยตอบ")).toBeInTheDocument();
    expect(screen.getByText("ขอคืนเงิน · ของเสีย 50 ชิ้น")).toBeInTheDocument();
    expect(screen.getByText("แชตนี้ หรือ [ช่องทางติดต่อของร้าน]")).toBeInTheDocument();
    expect(screen.getByText("ผู้ช่วย AI จะไม่รับปากเรื่องคืนเงินหรือส่วนลดแทนเฮียชัย")).toBeInTheDocument();
  });
});

describe("SystemNotice", () => {
  it("ราคาล็อก", () => {
    render(<SystemNotice kind="price_locked" />);
    expect(screen.getByText("ราคาล็อกโดยระบบของร้าน")).toBeInTheDocument();
  });

  it("เสียงยังไม่พร้อม", () => {
    render(<SystemNotice kind="voice_unavailable" />);
    expect(screen.getByText("ข้อความเสียงยังไม่พร้อม ตอบเป็นข้อความแทน")).toBeInTheDocument();
  });
});
