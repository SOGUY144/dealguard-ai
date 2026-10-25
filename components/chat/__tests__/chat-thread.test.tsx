// @vitest-environment jsdom
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { buildScenario, type ScenarioName } from "@/lib/chat/scenarios";
import type { Storefront } from "@/lib/chat/types";
import { ChatThread } from "../chat-thread";

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

function renderScenario(name: ScenarioName) {
  const handlers = {
    onSelectOffer: vi.fn(),
    onConfirmOffer: vi.fn(),
    onOpenProducts: vi.fn(),
    onShowOffers: vi.fn(),
  };
  const state = buildScenario(name, { storefront, products, buyerName: "คุณนก" });
  render(<ChatThread messages={state.messages} storefront={storefront} buyerName="คุณนก" {...handlers} />);
  return { handlers, state, log: screen.getByRole("log") };
}

describe("ChatThread", () => {
  it("เป็น live region ให้ screen reader อ่านข้อความใหม่", () => {
    const { log } = renderScenario("start");
    expect(log).toHaveAttribute("aria-live", "polite");
  });

  it("มีป้ายวันเวลาเริ่มแชต", () => {
    renderScenario("start");
    expect(screen.getByText("วันนี้ · 21:30")).toBeInTheDocument();
  });

  it("แชตจริงที่เริ่มวันก่อน → ป้ายบอกวันที่จริง ไม่ใช่ 'วันนี้'", () => {
    const state = buildScenario("start", { storefront, products, buyerName: "คุณนก" });
    render(
      <ChatThread
        messages={state.messages}
        storefront={storefront}
        buyerName="คุณนก"
        today={new Date(Date.parse(state.messages[0].at) + 2 * 24 * 60 * 60 * 1000)}
        onSelectOffer={vi.fn()}
        onConfirmOffer={vi.fn()}
        onOpenProducts={vi.fn()}
        onShowOffers={vi.fn()}
      />,
    );
    expect(screen.queryByText(/^วันนี้/)).not.toBeInTheDocument();
    expect(screen.getByText(/ต\.ค\. 2569 · 21:30/)).toBeInTheDocument();
  });

  it("ส่งเรื่องให้เถ้าแก่แล้ว (โหมด human) → การ์ดข้อเสนอเดิมล็อก กดยืนยันไม่ได้", () => {
    const state = buildScenario("offers", { storefront, products, buyerName: "คุณนก" });
    const messages = state.messages.map((m) => (m.type === "offers" ? { ...m, selectedId: "A" as const } : m));
    render(
      <ChatThread
        messages={messages}
        storefront={storefront}
        buyerName="คุณนก"
        mode="human"
        onSelectOffer={vi.fn()}
        onConfirmOffer={vi.fn()}
        onOpenProducts={vi.fn()}
        onShowOffers={vi.fn()}
      />,
    );
    expect(screen.queryByRole("button", { name: /ยืนยันข้อ/ })).not.toBeInTheDocument();
  });

  it("ข้อความแรกบอกว่าเป็นผู้ช่วย AI และปุ่มในฟองเปิดรายการสินค้า", () => {
    const { handlers } = renderScenario("start");
    expect(screen.getByText(/สวัสดีครับ ผู้ช่วย AI ของเฮียชัยครับ/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "ดูสินค้าทั้งหมด" }));
    expect(handlers.onOpenProducts).toHaveBeenCalled();
  });

  it("ชื่อผู้พูดเหนือฟอง: AI กับ 'คุณนก (คุณ)'", () => {
    renderScenario("product");
    expect(screen.getAllByText("ผู้ช่วย AI ของเฮียชัย").length).toBeGreaterThan(0);
    expect(screen.getByText("คุณนก (คุณ)")).toBeInTheDocument();
  });

  it("การ์ดสินค้าที่ลูกค้าเลือก", () => {
    renderScenario("product");
    const card = screen.getByRole("article", { name: "สายชาร์จ Type-C 1 เมตร" });
    expect(within(card).getByText("CBL-C-1M")).toBeInTheDocument();
    expect(within(card).getByText("฿150")).toBeInTheDocument();
  });

  it("ลูกค้าพูดมา: บอกว่าเป็นข้อความเสียง และ AI ตอบเป็นเสียง + transcript + ข้อเสนอ", () => {
    const { handlers, state } = renderScenario("offers");
    expect(screen.getByText("ส่งด้วยเสียง")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "เล่นข้อความเสียง" })).toBeInTheDocument();
    expect(screen.getByText(/สวัสดีครับคุณนก ราคา 125/)).toBeInTheDocument();

    const group = screen.getByRole("group", { name: "3 ทางเลือกจากเฮียชัย" });
    fireEvent.click(within(group).getAllByRole("button")[2]);
    const offersId = state.messages.find((m) => m.type === "offers")!.id;
    expect(handlers.onSelectOffer).toHaveBeenCalledWith(offersId, "C");

    fireEvent.click(screen.getByRole("button", { name: /ยืนยันข้อ A/ }));
    expect(handlers.onConfirmOffer).toHaveBeenCalledWith(offersId, "A");
  });

  it("ลูกค้าพิมพ์มา: ไม่มีข้อความเสียง", () => {
    renderScenario("text");
    expect(screen.queryByRole("button", { name: "เล่นข้อความเสียง" })).not.toBeInTheDocument();
  });

  it("เสียงล่ม: บอกว่าเสียงยังไม่พร้อม", () => {
    renderScenario("novoice");
    expect(screen.getByText("ข้อความเสียงยังไม่พร้อม ตอบเป็นข้อความแทน")).toBeInTheDocument();
  });

  it("ยืนยันแล้ว: ใบสรุปออเดอร์", () => {
    renderScenario("ordered");
    expect(screen.getByText("ส่งออเดอร์ให้ร้านแล้วครับ")).toBeInTheDocument();
    expect(screen.getByText("เลือกข้อ A · ซื้อเยอะ")).toBeInTheDocument();
  });

  it("ลูกค้าหลอก: ราคาล็อก และปุ่มกลับไปดูข้อเสนอ", () => {
    const { handlers } = renderScenario("guard");
    expect(screen.getByText("ราคาล็อกโดยระบบของร้าน")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "ดูข้อเสนอ 3 ทางอีกครั้ง" }));
    expect(handlers.onShowOffers).toHaveBeenCalled();
  });

  it("มีข้อเสนอชุดใหม่แล้ว ชุดเก่ากดไม่ได้ (กันยืนยันซ้อนกัน)", () => {
    const base = buildScenario("text", { storefront, products, buyerName: "คุณนก" });
    const older = base.messages.find((m) => m.type === "offers")!;
    const messages = [...base.messages, { ...older, id: "newer" }];
    render(
      <ChatThread
        messages={messages}
        storefront={storefront}
        buyerName="คุณนก"
        onSelectOffer={vi.fn()}
        onConfirmOffer={vi.fn()}
        onOpenProducts={vi.fn()}
        onShowOffers={vi.fn()}
      />,
    );
    const [oldGroup, newGroup] = screen.getAllByRole("group", { name: "3 ทางเลือกจากเฮียชัย" });
    for (const b of within(oldGroup).getAllByRole("button")) expect(b).toBeDisabled();
    for (const b of within(newGroup).getAllByRole("button")) expect(b).toBeEnabled();
  });

  it("ส่งเรื่องให้เถ้าแก่: การ์ดสถานะ", () => {
    renderScenario("escalate");
    expect(screen.getByText("ส่งเรื่องให้เฮียชัยแล้ว")).toBeInTheDocument();
  });

  it("เถ้าแก่ตอบเอง → ฟองฝั่งร้านพร้อมชื่อเถ้าแก่ (ไม่ใช่ไอคอน AI) และแจ้งเมื่อ AI กลับมาตอบ", () => {
    const at = "2026-10-24T03:00:00.000Z";
    render(
      <ChatThread
        messages={[
          { id: "b", at, type: "buyer_text", text: "ของเสีย ขอคืนเงิน", inputMode: "text" },
          { id: "o1", at, type: "owner_text", text: "ขอรูปของที่เสียหน่อยครับ" },
          { id: "o2", at, type: "owner_text", text: "เดี๋ยวเฮียโทรกลับครับ" },
          { id: "s", at, type: "system", kind: "ai_resumed" },
        ]}
        storefront={storefront}
        buyerName="คุณนก"
        onSelectOffer={vi.fn()}
        onConfirmOffer={vi.fn()}
        onOpenProducts={vi.fn()}
        onShowOffers={vi.fn()}
      />,
    );
    const row = screen.getByRole("group", { name: "ข้อความจากเฮียชัย" });
    expect(within(row).getByText("ขอรูปของที่เสียหน่อยครับ")).toBeInTheDocument();
    expect(within(row).getByText("เดี๋ยวเฮียโทรกลับครับ")).toBeInTheDocument();
    expect(screen.getByText("ผู้ช่วย AI กลับมาตอบแล้ว")).toBeInTheDocument();
  });
});


describe("ChatThread — ฉลองตอนปิดดีล", () => {
  const handlers = { onSelectOffer: vi.fn(), onConfirmOffer: vi.fn(), onOpenProducts: vi.fn(), onShowOffers: vi.fn() };
  const offers = buildScenario("offers", { storefront, products, buyerName: "คุณนก" }).messages;
  const ordered = buildScenario("ordered", { storefront, products, buyerName: "คุณนก" }).messages;
  const confetti = (container: HTMLElement) => container.querySelector(".confetti");

  it("เปิดหน้ามาเจอออเดอร์เก่า → ไม่ฉลองซ้ำ", () => {
    const { container } = render(<ChatThread messages={ordered} storefront={storefront} buyerName="คุณนก" {...handlers} />);
    expect(screen.getByText("ส่งออเดอร์ให้ร้านแล้วครับ")).toBeInTheDocument();
    expect(confetti(container)).toBeNull();
  });

  it("ลูกค้าเพิ่งยืนยันข้อเสนอ → ใบสรุปออเดอร์มาพร้อมกระดาษสีและวงแสง", () => {
    const { container, rerender } = render(
      <ChatThread messages={offers} storefront={storefront} buyerName="คุณนก" {...handlers} />,
    );
    expect(confetti(container)).toBeNull();
    rerender(<ChatThread messages={ordered} storefront={storefront} buyerName="คุณนก" {...handlers} />);
    expect(confetti(container)).toHaveAttribute("aria-hidden", "true");
    expect(container.querySelector(".deal-fresh")).toHaveTextContent("ส่งออเดอร์ให้ร้านแล้วครับ");
  });
});
