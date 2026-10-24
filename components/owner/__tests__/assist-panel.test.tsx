// @vitest-environment jsdom
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AssistPanel, type AssistView } from "../assist-panel";

const view: AssistView = {
  replyText: "สวัสดีครับคุณนก ราคา 125 ที่ 1,000 ชิ้นเฮียชัยให้ไม่ไหว แต่มี 1 ทางให้เลือกครับ\nA · จ่ายสด ฿147/ชิ้น — 1,000 ชิ้น · โอนทันที (รวม ฿147,000)\nสนใจข้อไหนตอบกลับมาได้เลยครับ",
  offers: [
    { offer: { id: "A", lever: "cash", label: "จ่ายสด", pricePerUnit: 147, qty: 1000, conditionText: "1,000 ชิ้น · โอนทันที", total: 147000, creditDays: 0 }, profit: 48450 },
  ],
  decision: null,
  missing: null,
  productName: "สายชาร์จ",
};

describe("AssistPanel (ผู้ช่วยตอบ LINE)", () => {
  it("วางข้อความ → เห็นข้อเสนอพร้อมกำไร + ข้อความพร้อมคัดลอก", async () => {
    const assist = vi.fn(async () => view);
    const writeText = vi.fn(async () => {});
    Object.assign(navigator, { clipboard: { writeText } });
    render(<AssistPanel assist={assist} />);

    fireEvent.change(screen.getByLabelText(/ข้อความลูกค้า/), { target: { value: "ขอ 125 ได้ไหม 1000 ชิ้น\nไม่ซื้อเพิ่ม" } });
    fireEvent.change(screen.getByLabelText(/ชื่อลูกค้า/), { target: { value: "นก" } });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "คิดข้อเสนอ" })));
    expect(assist).toHaveBeenCalledWith({ text: "ขอ 125 ได้ไหม 1000 ชิ้น\nไม่ซื้อเพิ่ม", buyerName: "นก" });

    const offers = screen.getByRole("list", { name: "ข้อเสนอ" });
    expect(within(offers).getByText("กำไร ฿48,450")).toBeInTheDocument();
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "คัดลอกข้อความ" })));
    expect(writeText).toHaveBeenCalledWith(view.replyText);
    expect(screen.getByRole("button", { name: /คัดลอกแล้ว/ })).toBeInTheDocument();
  });

  it("เรื่องที่ต้องตัดสินเอง → ไม่มีข้อความให้คัดลอก แต่เห็นสรุป 3 บรรทัด", async () => {
    const decision: AssistView = { ...view, replyText: "", offers: [], decision: ["คุณนก ไม่รับทุกทางเลือก", "ขอ 1,000 ชิ้น ที่ ฿125", "AI ไม่ลดเพิ่มเอง · ถ้ายอม ฿125 ได้กำไร ฿25,000"] };
    render(<AssistPanel assist={async () => decision} />);
    fireEvent.change(screen.getByLabelText(/ข้อความลูกค้า/), { target: { value: "ไม่เอาสักอย่าง" } });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "คิดข้อเสนอ" })));
    expect(screen.getByText("เรื่องนี้ให้คุณตัดสินเอง — AI ไม่ลดเพิ่มเอง")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "คัดลอกข้อความ" })).not.toBeInTheDocument();
  });

  it("เรียก API ไม่สำเร็จ → บอกให้ลองใหม่", async () => {
    render(<AssistPanel assist={async () => { throw new Error("x"); }} />);
    fireEvent.change(screen.getByLabelText(/ข้อความลูกค้า/), { target: { value: "ขอลด" } });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "คิดข้อเสนอ" })));
    expect(screen.getByRole("alert")).toHaveTextContent("คิดข้อเสนอไม่สำเร็จ");
  });
});
