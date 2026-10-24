// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MOCK_OFFERS } from "@/lib/chat/mock-offers";
import type { OwnerDeal, OwnerEscalation } from "@/lib/owner/summary";
import { summarize } from "@/lib/owner/summary";
import { ActiveChats } from "../active-chats";
import { Deals, signedBaht } from "../deals";
import { Escalations } from "../escalations";
import { OwnerBottomNav, OwnerSidebar } from "../owner-nav";
import { ProfitChart } from "../profit-chart";
import { StatTiles } from "../stat-tiles";

// ตัวอย่างใน SKILL §6.5 (ขอ ฿125 × 1,000 → ยอมลดได้กำไร ฿25,000)
const deals: OwnerDeal[] = [45_000, 36_332, 42_000].map((marginOffer, i) => ({
  id: `o${i}`,
  at: `2026-10-24T0${i + 3}:00:00Z`,
  buyerName: i === 0 ? "คุณนก" : `ลูกค้า ${i + 1}`,
  productName: "สายชาร์จ Type-C 1 เมตร",
  offer: MOCK_OFFERS[i],
  marginIfConceded: 25_000,
  marginOffer,
  recoveredMargin: marginOffer - 25_000,
}));

const escalations: OwnerEscalation[] = [
  {
    id: "e1",
    chatId: "c1",
    kind: "over_value",
    brief: ["คุณนก ขอสายชาร์จ 50,000 ชิ้น ที่ ฿125", "มูลค่าราว ฿6.25 ล้าน เกินเกณฑ์ ฿300,000", "AI ยังไม่เสนอราคา"],
    at: "2026-10-24T15:47:00Z",
  },
];

describe("StatTiles", () => {
  it("ตัวเลขตามตัวอย่าง SKILL: กำไรที่รักษาไว้ ฿48,332 · ยอดขาย ฿475,000 · 3 ดีล", () => {
    render(<StatTiles totals={summarize(deals)} />);
    expect(screen.getAllByText("฿48,332").length).toBeGreaterThan(0);
    expect(screen.getAllByText("฿475,000").length).toBeGreaterThan(0);
    expect(screen.getAllByText("3 ดีล").length).toBeGreaterThan(0);
    expect(screen.getByText("จาก 3 ดีลวันนี้")).toBeInTheDocument();
  });
});

describe("Deals", () => {
  it("ตาราง: ดีลล่าสุดอยู่บน กำไรที่รักษาไว้มีเครื่องหมาย + และของแถมอยู่ในเงื่อนไข", () => {
    render(<Deals deals={deals} />);
    const rows = within(screen.getByRole("table")).getAllByRole("row").slice(1);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveTextContent("รับของแถม");
    expect(rows[0]).toHaveTextContent("฿145 × 1,000 + แถม 200");
    expect(rows[2]).toHaveTextContent("คุณนก");
    expect(rows[2]).toHaveTextContent("+฿20,000");
  });

  it("ยังไม่มีดีล → บอกว่ายังไม่มี", () => {
    render(<Deals deals={[]} />);
    expect(screen.getByText("ยังไม่มีดีลที่ปิดได้วันนี้")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("signedBaht", () => {
    expect(signedBaht(11_332.4)).toBe("+฿11,332");
    expect(signedBaht(-500)).toBe("−฿500");
  });
});

describe("ProfitChart", () => {
  it("กราฟมีคำอธิบายสำหรับ screen reader ครบทุกดีล", () => {
    render(<ProfitChart deals={deals} />);
    const chart = screen.getByRole("img");
    expect(chart).toHaveAccessibleName(/คุณนก ถ้ายอมลด 25,000 บาท ข้อเสนอที่ปิดได้ 45,000 บาท/);
    expect(chart).toHaveAccessibleName(/36,332/);
  });

  it("ยังไม่มีดีล → ไม่มีกราฟ", () => {
    render(<ProfitChart deals={[]} />);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
});

describe("Escalations", () => {
  it("ประเภท + เวลาไทย + Deal Brief · ปุ่มตอบพาไปหน้าแชตของเรื่องนั้น", () => {
    render(<Escalations escalations={escalations} openCount={1} ownerName="เฮียชัย" />);
    expect(screen.getAllByText(/เกินเกณฑ์มูลค่า/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/22:47/).length).toBeGreaterThan(0);
    expect(screen.getByText(/มูลค่าราว ฿6.25 ล้าน/)).toBeInTheDocument();
    for (const name of ["ตอบเอง", "ดูแชต", "ตอบ"]) {
      expect(screen.getByRole("link", { name }).getAttribute("href")).toMatch(/^\/owner\/chats\/c1(#reply)?$/);
    }
  });

  it("จำนวนจริงมากกว่ารายการที่แสดง → หัวกล่องบอกจำนวนจริง", () => {
    render(<Escalations escalations={escalations} openCount={35} ownerName="เฮียชัย" />);
    expect(screen.getAllByText(/35/).length).toBeGreaterThan(0);
  });

  it("ไม่มีเรื่องรอ → บอกว่าไม่มี", () => {
    render(<Escalations escalations={[]} openCount={0} ownerName="เฮียชัย" />);
    expect(screen.getByText("ไม่มีเรื่องที่รอตัดสิน")).toBeInTheDocument();
  });
});

describe("OwnerSidebar / OwnerBottomNav", () => {
  it("หน้าปัจจุบันมี aria-current · badge รอตัดสินบอกจำนวนให้ screen reader", () => {
    render(<OwnerSidebar openCount={2} />);
    expect(screen.getByRole("link", { name: "ภาพรวม" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: /รอตัดสิน\s*มี\s*2\s*เรื่อง/ })).toHaveAttribute("href", "/owner/escalations");
    expect(screen.getByRole("link", { name: "ดีลทั้งหมด" })).toHaveAttribute("href", "/owner/deals");
    const products = screen.getByRole("link", { name: "สินค้าและราคา" });
    expect(products).toHaveAttribute("href", "/owner/products");
    expect(products).not.toHaveAttribute("aria-current");
  });

  it("หน้าสินค้าและราคา: เมนูสินค้าเป็นหน้าปัจจุบัน", () => {
    render(<OwnerSidebar openCount={0} current="products" />);
    expect(screen.getByRole("link", { name: "สินค้าและราคา" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "ภาพรวม" })).not.toHaveAttribute("aria-current");
  });

  it("มือถือ: 4 เมนู กดได้ทุกเมนู", () => {
    render(<OwnerBottomNav openCount={0} current="products" />);
    const nav = screen.getByRole("navigation", { name: "เมนูเถ้าแก่" });
    expect(within(nav).getAllByRole("link")).toHaveLength(4);
    expect(within(nav).getByRole("link", { name: "สินค้า" })).toHaveAttribute("aria-current", "page");
  });
});

describe("ActiveChats (แชตที่กำลังคุย)", () => {
  it("แต่ละแถว: ชื่อ · สถานะ · ข้อความล่าสุด · เวลา และพาไปหน้าแชต", () => {
    render(
      <ActiveChats
        chats={[
          { chatId: "c1", buyerName: "คุณนก", status: "ai", preview: "ขอ 125 ได้ไหม", at: "2026-10-24T03:00:00Z" },
          { chatId: "c2", buyerName: "ลูกค้า 2", status: "owner", preview: "ส่งเรื่องให้เถ้าแก่ · ขอคืนเงิน", at: "2026-10-24T02:00:00Z" },
        ]}
      />,
    );
    const first = screen.getByRole("link", { name: /คุณนก/ });
    expect(first).toHaveAttribute("href", "/owner/chats/c1");
    expect(within(first).getByText("AI กำลังคุย")).toBeInTheDocument();
    expect(within(first).getByText("10:00")).toBeInTheDocument();
    expect(within(screen.getByRole("link", { name: /ลูกค้า 2/ })).getByText("เถ้าแก่ดูแล")).toBeInTheDocument();
  });

  it("ยังไม่มีแชต → บอกว่าไม่มี", () => {
    render(<ActiveChats chats={[]} />);
    expect(screen.getByText("ยังไม่มีแชตวันนี้")).toBeInTheDocument();
  });
});

