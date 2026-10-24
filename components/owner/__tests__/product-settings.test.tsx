// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ProductSettingsForm, ProductSettingsPage, SaveResult } from "@/lib/owner/product-settings";
import { ProductSettings } from "../product-settings";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const page: ProductSettingsPage = {
  products: [
    {
      sku: "CBL-C-1M",
      name: "สายชาร์จ Type-C 1 เมตร",
      listPrice: 150,
      unitCost: 100,
      floorPrice: 120,
      tiers: [
        { minQty: 500, price: 140 },
        { minQty: 1500, price: 130 },
        { minQty: 3000, price: 125 },
      ],
      cashDiscountPct: 10,
      defaultCreditDays: 30,
      aiEnabled: true,
      costOfCapitalPct: 12,
      escalationDealValue: 300_000,
      gifts: [{ sku: "ADP-20W", enabled: true }],
    },
  ],
  gifts: [{ sku: "ADP-20W", name: "หัวชาร์จ 20W", unitCost: 15, perceivedValue: 50, qtyAvailable: 500, enabled: true }],
};

type Save = (form: ProductSettingsForm) => Promise<SaveResult>;
const setup = (save = vi.fn<Save>(async () => ({ ok: true }))) => {
  render(<ProductSettings page={page} save={save} />);
  return save;
};
const input = (label: string) => screen.getByLabelText(label) as HTMLInputElement;
const change = (el: HTMLElement, value: string) => fireEvent.change(el, { target: { value } });

describe("ProductSettings (Owner-Settings)", () => {
  it("แสดงค่าปัจจุบันตามดีไซน์: ราคา 3 ช่อง ช่วงราคา ขั้นราคา กำไรต่อชิ้น", () => {
    setup();
    expect(screen.getByRole("heading", { level: 2, name: "สายชาร์จ Type-C 1 เมตร" })).toBeInTheDocument();
    expect(input("ราคาขาย").value).toBe("150");
    expect(input("ต้นทุน (ลูกค้าไม่เห็น)").value).toBe("100");
    expect(input("ราคาพื้น (ลูกค้าไม่เห็น)").value).toBe("120");
    expect(
      screen.getByRole("img", { name: "ช่วงราคา ต้นทุน 100 บาท ราคาพื้น 120 บาท ราคาขาย 150 บาท AI ต่อรองได้ระหว่าง 120 ถึง 150 บาท" }),
    ).toBeInTheDocument();
    expect(screen.getByText("กำไรต่อชิ้นที่ราคาพื้น ฿20 · ที่ราคาขาย ฿50")).toBeInTheDocument();
    expect(screen.getAllByLabelText("จำนวนขั้นต่ำ")).toHaveLength(3);
    expect(screen.getByText("กำไร ฿40/ชิ้น")).toBeInTheDocument();
    expect(screen.getByText("ทุกขั้นไม่ต่ำกว่าราคาพื้น")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /ให้ AI ต่อราคาสินค้านี้/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "ใช้หัวชาร์จ 20W เป็นของแถม" })).toHaveAttribute("aria-pressed", "true");
    expect(input("ดีลมูลค่าเกิน").value).toBe("300,000");
  });

  it("ขั้นราคาต่ำกว่าพื้น → บอกตรงช่อง ป้ายเปลี่ยนเป็นเตือน และไม่บันทึก", async () => {
    const save = setup();
    change(screen.getAllByLabelText("ราคาต่อชิ้น")[2], "110");
    expect(screen.getByText("ต่ำกว่าราคาพื้น ฿120")).toBeInTheDocument();
    expect(screen.getByText("มีขั้นที่ต่ำกว่าราคาพื้น")).toBeInTheDocument();
    expect(screen.getAllByLabelText("ราคาต่อชิ้น")[2]).toHaveAttribute("aria-invalid", "true");
    fireEvent.click(screen.getByRole("button", { name: "บันทึก" }));
    expect(save).not.toHaveBeenCalled();
    expect(await screen.findByRole("alert")).toHaveTextContent("ยังบันทึกไม่ได้");
  });

  it("เพิ่ม / ลบขั้น", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "+ เพิ่มขั้น" }));
    expect(screen.getAllByLabelText("จำนวนขั้นต่ำ")).toHaveLength(4);
    fireEvent.click(screen.getAllByRole("button", { name: "ลบขั้นนี้" })[0]);
    expect(screen.getAllByLabelText("จำนวนขั้นต่ำ")).toHaveLength(3);
    expect(screen.getAllByLabelText("จำนวนขั้นต่ำ")[0]).toHaveValue(1500);
  });

  it("บันทึก → ส่งค่าเป็นตัวเลข (ตัดคอมม่า) แล้วบอกว่าบันทึกแล้ว", async () => {
    const save = setup();
    change(input("ราคาพื้น (ลูกค้าไม่เห็น)"), "125");
    change(input("ดีลมูลค่าเกิน"), "250,000");
    fireEvent.click(screen.getByRole("button", { name: /ให้ AI ต่อราคาสินค้านี้/ }));
    fireEvent.click(screen.getByRole("button", { name: "ใช้หัวชาร์จ 20W เป็นของแถม" }));
    fireEvent.click(screen.getByRole("button", { name: "บันทึก" }));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({
        sku: "CBL-C-1M",
        floorPrice: 125,
        escalationDealValue: 250_000,
        aiEnabled: false,
        gifts: [{ sku: "ADP-20W", enabled: false }],
        tiers: page.products[0].tiers,
      }),
    );
    expect(await screen.findByRole("status")).toHaveTextContent("บันทึกแล้ว");
  });

  it("server ปฏิเสธ → แสดงข้อผิดจาก server", async () => {
    setup(vi.fn<Save>(async () => ({ ok: false, errors: { form: "บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง" } })));
    fireEvent.click(screen.getByRole("button", { name: "บันทึก" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง");
  });

  it("ยกเลิก → กลับเป็นค่าเดิม", () => {
    setup();
    change(input("ราคาขาย"), "999");
    fireEvent.click(screen.getByRole("button", { name: "ยกเลิก" }));
    expect(input("ราคาขาย").value).toBe("150");
  });

  it("เงื่อนไขส่งเถ้าแก่ 3 ข้อเปิดไว้เสมอ ปิดไม่ได้ (กันข้ามกฎความปลอดภัย)", () => {
    setup();
    const group = screen.getByRole("group", { name: "ส่งให้เถ้าแก่ตัดสินเมื่อ" });
    const boxes = within(group).getAllByRole("checkbox");
    expect(boxes).toHaveLength(3);
    for (const box of boxes) {
      expect(box).toBeChecked();
      expect(box).toBeDisabled();
    }
  });

  it("ปุ่มที่ยังไม่มีในระบบ (นำเข้า Excel / เพิ่มสินค้า) กดไม่ได้", () => {
    setup();
    expect(screen.getByRole("button", { name: "นำเข้าจาก Excel" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "เพิ่มสินค้า" })).toBeDisabled();
  });
});
