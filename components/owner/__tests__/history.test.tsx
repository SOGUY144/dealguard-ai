// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MOCK_OFFERS } from "@/lib/chat/mock-offers";
import type { EscalationEntry, OwnerDeal } from "@/lib/owner/summary";
import { DealHistory } from "../deal-history";
import { EscalationHistory } from "../escalation-history";

const deal = (id: string, at: string, letter: 0 | 1): OwnerDeal => ({
  id,
  chatId: `chat-${id}`,
  at,
  buyerName: "คุณนก",
  productName: "สายชาร์จ Type-C 1 เมตร",
  offer: MOCK_OFFERS[letter],
  marginIfConceded: 25_000,
  marginOffer: letter === 0 ? 45_000 : 36_332,
  recoveredMargin: letter === 0 ? 20_000 : 11_332,
});

describe("DealHistory (ดีลทั้งหมด)", () => {
  const deals = [deal("a", "2026-10-23T02:00:00Z", 0), deal("b", "2026-10-24T03:00:00Z", 1)];

  it("สรุปยอดของช่วงที่เลือก + แยกตามวัน (ใหม่ก่อน) + ลิงก์ไปแชตของดีล", () => {
    render(<DealHistory deals={deals} range="all" />);
    expect(screen.getByText("฿31,332")).toBeInTheDocument();
    expect(screen.getByText("฿330,000")).toBeInTheDocument();
    const days = screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);
    expect(days).toEqual(["24 ต.ค. 2569", "23 ต.ค. 2569"]);
    const links = screen.getAllByRole("link", { name: /ดูแชต/ });
    expect(links.map((l) => l.getAttribute("href"))).toEqual(["/owner/chats/chat-b", "/owner/chats/chat-a"]);
  });

  it("แท็บช่วงวัน: ช่วงปัจจุบันมี aria-current", () => {
    render(<DealHistory deals={deals} range="7d" />);
    const tabs = screen.getByRole("navigation", { name: "ช่วงวัน" });
    expect(within(tabs).getByRole("link", { name: "7 วัน" })).toHaveAttribute("aria-current", "page");
    expect(within(tabs).getByRole("link", { name: "ทั้งหมด" })).toHaveAttribute("href", "/owner/deals?range=all");
  });

  it("ไม่มีดีลในช่วงนี้ → บอกให้ชัด", () => {
    render(<DealHistory deals={[]} range="today" />);
    expect(screen.getByText("ยังไม่มีดีลที่ปิดได้ในช่วงนี้")).toBeInTheDocument();
  });
});

describe("EscalationHistory (รอตัดสิน)", () => {
  const entry = (id: string, status: "open" | "resolved"): EscalationEntry => ({
    id,
    chatId: `chat-${id}`,
    kind: "refund",
    brief: ["คุณนก ขอคืนเงิน", '"ของเสีย 50 ชิ้น"', "AI ไม่รับปากเรื่องคืนเงิน"],
    at: "2026-10-23T02:00:00Z",
    status,
    buyerName: "คุณนก",
  });

  it("เรื่องที่รอ: หัวข้อ ชื่อลูกค้า สรุป 3 บรรทัด วันที่ และปุ่มตอบไปหน้าแชต", () => {
    render(<EscalationHistory entries={[entry("e1", "open")]} status="open" openCount={1} />);
    expect(screen.getByText("ขอคืนเงิน")).toBeInTheDocument();
    expect(screen.getByText("คุณนก ขอคืนเงิน")).toBeInTheDocument();
    expect(screen.getByText(/23 ต.ค. 2569/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /ตอบ/ })).toHaveAttribute("href", "/owner/chats/chat-e1#reply");
    expect(within(screen.getByRole("navigation", { name: "สถานะ" })).getByRole("link", { name: /รอตัดสิน/ })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("เรื่องที่ปิดแล้ว: ลิงก์ดูแชต", () => {
    render(<EscalationHistory entries={[entry("e2", "resolved")]} status="resolved" openCount={0} />);
    expect(screen.getByRole("link", { name: /ดูแชต/ })).toHaveAttribute("href", "/owner/chats/chat-e2");
  });

  it("ว่าง → บอกให้ชัด", () => {
    render(<EscalationHistory entries={[]} status="open" openCount={0} />);
    expect(screen.getByText("ไม่มีเรื่องที่รอตัดสิน")).toBeInTheDocument();
  });
});
