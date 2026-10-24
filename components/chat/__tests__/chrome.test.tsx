// @vitest-environment jsdom
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ChatHeader } from "../chat-header";
import { Composer } from "../composer";
import { ProductDrawer, ProductSheet } from "../product-panel";

const products = [
  { sku: "CBL-C-1M", name: "สายชาร์จ Type-C 1 เมตร", listPrice: 150 },
  { sku: "ADP-20W", name: "หัวชาร์จ 20W", listPrice: 90 },
];

describe("ChatHeader", () => {
  it("บอกชื่อผู้ช่วย AI สถานะ และมีปุ่มคุยกับคนจริงเสมอ", () => {
    const onTalk = vi.fn();
    render(<ChatHeader assistantName="ผู้ช่วย AI ของเฮียชัย" onTalkToHuman={onTalk} />);
    expect(screen.getByText("ผู้ช่วย AI ของเฮียชัย")).toBeInTheDocument();
    expect(screen.getByText("ออนไลน์ · พิมพ์หรือกดไมค์พูดได้")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "คุยกับคนจริง" }));
    expect(onTalk).toHaveBeenCalled();
  });
});

describe("ChatHeader — ออกจากระบบ", () => {
  it("ปุ่มออกจากระบบเป็นฟอร์ม POST ไป /auth/logout (โหลดหน้าใหม่ทั้งหน้า)", () => {
    render(<ChatHeader assistantName="ผู้ช่วย AI ของเฮียชัย" onTalkToHuman={() => {}} canLogout />);
    fireEvent.click(screen.getByRole("button", { name: "เมนู" }));
    const button = screen.getByRole("button", { name: "ออกจากระบบ" });
    expect(button).toHaveAttribute("type", "submit");
    expect(button.closest("form")).toHaveAttribute("action", "/auth/logout");
    expect(button.closest("form")).toHaveAttribute("method", "post");
  });

  it("ไม่ได้ล็อกอิน → ไม่มีปุ่ม", () => {
    render(<ChatHeader assistantName="ผู้ช่วย AI ของเฮียชัย" onTalkToHuman={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "เมนู" }));
    expect(screen.queryByRole("button", { name: "ออกจากระบบ" })).not.toBeInTheDocument();
  });
});

describe("Composer", () => {
  function setup(props: Partial<Parameters<typeof Composer>[0]> = {}) {
    const handlers = { onSend: vi.fn(), onSuggestion: vi.fn(), onToggleProducts: vi.fn(), onMicPress: vi.fn() };
    render(
      <Composer
        placeholder="พิมพ์จำนวนกับราคาที่อยากได้"
        suggestions={[]}
        productsOpen={false}
        voiceState="idle"
        {...handlers}
        {...props}
      />,
    );
    return handlers;
  }

  it("พิมพ์แล้วกด Enter → ส่งข้อความและล้างช่อง", async () => {
    const { onSend } = setup();
    const input = screen.getByRole("textbox", { name: "พิมพ์ข้อความ" });
    await userEvent.type(input, "ขอ 125 ได้ไหม{Enter}");
    expect(onSend).toHaveBeenCalledWith("ขอ 125 ได้ไหม");
    expect(input).toHaveValue("");
  });

  it("กดปุ่มส่งได้เหมือนกัน", async () => {
    const { onSend } = setup();
    await userEvent.type(screen.getByRole("textbox", { name: "พิมพ์ข้อความ" }), "1,000 ชิ้น");
    fireEvent.click(screen.getByRole("button", { name: "ส่งข้อความ" }));
    expect(onSend).toHaveBeenCalledWith("1,000 ชิ้น");
  });

  it("ช่องว่างไม่ส่ง", () => {
    const { onSend } = setup();
    fireEvent.click(screen.getByRole("button", { name: "ส่งข้อความ" }));
    expect(onSend).not.toHaveBeenCalled();
  });

  it("chip คำตอบด่วน", () => {
    const action = { type: "open_products" } as const;
    const { onSuggestion } = setup({ suggestions: [{ label: "ดูสินค้าทั้งหมด", action }] });
    fireEvent.click(screen.getByRole("button", { name: "ดูสินค้าทั้งหมด" }));
    expect(onSuggestion).toHaveBeenCalledWith({ label: "ดูสินค้าทั้งหมด", action });
  });

  it("ปุ่มสินค้าบอกสถานะเปิด/ปิด", () => {
    const { onToggleProducts } = setup({ productsOpen: true });
    const button = screen.getByRole("button", { name: "สินค้า" });
    expect(button).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(button);
    expect(onToggleProducts).toHaveBeenCalled();
  });

  it("ไมค์: ปกติ → กำลังอัด → กำลังแปลงเสียง", () => {
    const { onMicPress } = setup();
    fireEvent.click(screen.getByRole("button", { name: "พูดด้วยเสียง" }));
    expect(onMicPress).toHaveBeenCalled();
  });

  it("ระหว่างอัดเสียง ปุ่มไมค์กลายเป็นหยุดแล้วส่ง และมีสถานะให้เห็น", () => {
    setup({ voiceState: "recording" });
    expect(screen.getByRole("button", { name: "หยุดและส่งเสียง" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("กำลังอัดเสียง");
  });

  it("ระหว่างแปลงเสียง ปิดปุ่มไมค์ชั่วคราว", () => {
    setup({ voiceState: "transcribing" });
    expect(screen.getByRole("button", { name: "พูดด้วยเสียง" })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("กำลังแปลงเสียงเป็นข้อความ");
  });
});

describe("ProductDrawer (คอม)", () => {
  it("แสดงสินค้า กดขอต่อราคา และสินค้าที่กำลังคุยอยู่บอกสถานะ", () => {
    const onAsk = vi.fn();
    render(<ProductDrawer products={products} activeSku="CBL-C-1M" onAsk={onAsk} onClose={() => {}} />);
    const panel = screen.getByRole("complementary", { name: "สินค้าในร้าน" });
    expect(within(panel).getByRole("button", { name: "กำลังต่อราคาในแชต" })).toBeInTheDocument();
    fireEvent.click(within(panel).getByRole("button", { name: "ขอต่อราคา" }));
    expect(onAsk).toHaveBeenCalledWith("ADP-20W");
  });

  it("ค้นหาสินค้าจากชื่อหรือ SKU", async () => {
    render(<ProductDrawer products={products} onAsk={() => {}} onClose={() => {}} />);
    await userEvent.type(screen.getByRole("searchbox", { name: "ค้นหาสินค้า" }), "adp");
    expect(screen.queryByText("สายชาร์จ Type-C 1 เมตร")).not.toBeInTheDocument();
    expect(screen.getByText("หัวชาร์จ 20W")).toBeInTheDocument();
  });

  it("ปุ่มปิด", () => {
    const onClose = vi.fn();
    render(<ProductDrawer products={products} onAsk={() => {}} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: "ปิดรายการสินค้า" }));
    expect(onClose).toHaveBeenCalled();
  });
});

describe("ProductSheet (มือถือ)", () => {
  it("เป็น dialog ที่โฟกัสปุ่มปิด และกด Esc เพื่อปิด", () => {
    const onClose = vi.fn();
    render(<ProductSheet products={products} onAsk={() => {}} onClose={onClose} />);
    const dialog = screen.getByRole("dialog", { name: "สินค้าในร้าน" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(screen.getByRole("button", { name: "ปิดรายการสินค้า" })).toHaveFocus();
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("แตะพื้นหลังเพื่อปิด", () => {
    const onClose = vi.fn();
    render(<ProductSheet products={products} onAsk={() => {}} onClose={onClose} />);
    fireEvent.click(screen.getByTestId("sheet-backdrop"));
    expect(onClose).toHaveBeenCalled();
  });

  it("ปุ่มบนมือถือใช้คำว่า 'ต่อราคา'", () => {
    const onAsk = vi.fn();
    render(<ProductSheet products={products} onAsk={onAsk} onClose={() => {}} />);
    fireEvent.click(screen.getAllByRole("button", { name: "ต่อราคา" })[0]);
    expect(onAsk).toHaveBeenCalledWith("CBL-C-1M");
  });
});
