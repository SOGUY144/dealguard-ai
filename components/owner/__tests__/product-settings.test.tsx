// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ProductSettingsForm, ProductSettingsPage, SaveResult } from "@/lib/owner/product-settings";
import { ProductSettings, type CatalogActions } from "../product-settings";

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

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
const ok = async () => ({ ok: true as const });
function mockActions(patch: Partial<CatalogActions> = {}) {
  return {
    save: vi.fn<Save>(ok),
    addProduct: vi.fn<CatalogActions["addProduct"]>(ok),
    saveGift: vi.fn<CatalogActions["saveGift"]>(ok),
    deleteItem: vi.fn<CatalogActions["deleteItem"]>(ok),
    uploadImage: vi.fn<CatalogActions["uploadImage"]>(async () => ({ ok: true, imageUrl: "https://img.test/new.webp" })),
    deleteImage: vi.fn<CatalogActions["deleteImage"]>(ok),
    importCatalog: vi.fn<CatalogActions["importCatalog"]>(async () => ({ ok: true, count: 1 })),
    ...patch,
  };
}
function renderWith(patch: Partial<CatalogActions> = {}, readXlsx?: (f: File) => Promise<unknown[][]>) {
  const actions = mockActions(patch);
  render(<ProductSettings page={page} actions={actions} shrink={async (f) => f} readXlsx={readXlsx} />);
  return actions;
}
const setup = (save = vi.fn<Save>(ok)) => renderWith({ save }).save;
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
    expect((screen.getByLabelText(/ดีลมูลค่าเกิน/) as HTMLInputElement).value).toBe("300,000");
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
    change(screen.getByLabelText(/ดีลมูลค่าเกิน/) as HTMLInputElement, "250,000");
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

  it("ไม่ได้แตะค่าระดับร้าน → ส่ง null (ไม่เขียนทับค่าที่อีกแท็บ/อีกเครื่องเพิ่งตั้ง) และไม่ส่งของแถมที่ไม่ได้กด", async () => {
    const save = setup();
    change(input("ราคาขาย"), "155");
    fireEvent.click(screen.getByRole("button", { name: "บันทึก" }));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ listPrice: 155, costOfCapitalPct: null, escalationDealValue: null, gifts: [] }));
  });

  it("ค่าที่ใช้ทั้งร้านบอกให้ชัด", () => {
    setup();
    expect(screen.getAllByText("(ใช้ทั้งร้าน)").length).toBeGreaterThanOrEqual(3);
  });

  it("แก้ชื่อสินค้าได้ — ส่งชื่อใหม่ไปบันทึก", async () => {
    const save = setup();
    change(input("ชื่อสินค้า"), "สาย Type-C 1 ม.");
    fireEvent.click(screen.getByRole("button", { name: "บันทึก" }));
    await waitFor(() => expect(save).toHaveBeenCalledWith(expect.objectContaining({ name: "สาย Type-C 1 ม." })));
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
});

describe("เพิ่ม / ลบ / ของแถม / รูป / นำเข้า", () => {
  it("เพิ่มสินค้า: กรอกไม่ครบ → บอกตรงช่อง · ครบ → บันทึกแล้วรีเฟรช", async () => {
    refresh.mockClear();
    const actions = renderWith();
    fireEvent.click(screen.getByRole("button", { name: "เพิ่มสินค้า" }));
    const dialog = screen.getByRole("dialog", { name: "เพิ่มสินค้า" });
    fireEvent.click(within(dialog).getByRole("button", { name: "เพิ่ม" }));
    expect(within(dialog).getByText("ใส่ชื่อสินค้า (ไม่เกิน 80 ตัวอักษร)")).toBeInTheDocument();
    expect(actions.addProduct).not.toHaveBeenCalled();

    change(within(dialog).getByLabelText("ชื่อสินค้า"), "สาย Lightning");
    change(within(dialog).getByLabelText("รหัสสินค้า (SKU)"), "CBL-C-1M");
    expect(within(dialog).getByText("รหัสนี้มีอยู่แล้ว")).toBeInTheDocument();
    change(within(dialog).getByLabelText("รหัสสินค้า (SKU)"), "CBL-L-1M");
    change(within(dialog).getByLabelText("ราคาขาย"), "180");
    change(within(dialog).getByLabelText("ต้นทุน (ลูกค้าไม่เห็น)"), "110");
    change(within(dialog).getByLabelText("ราคาพื้น (ลูกค้าไม่เห็น)"), "140");
    fireEvent.click(within(dialog).getByRole("button", { name: "เพิ่ม" }));
    await waitFor(() =>
      expect(actions.addProduct).toHaveBeenCalledWith({
        sku: "CBL-L-1M",
        name: "สาย Lightning",
        listPrice: 180,
        unitCost: 110,
        floorPrice: 140,
        cashDiscountPct: 0,
        defaultCreditDays: 30,
      }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(refresh).toHaveBeenCalled();
  });

  it("เพิ่มของแถม: เลือกประเภทของแถม แล้วส่งไปบันทึกของแถม", async () => {
    const actions = renderWith();
    fireEvent.click(screen.getByRole("button", { name: "เพิ่มสินค้า" }));
    const dialog = screen.getByRole("dialog", { name: "เพิ่มสินค้า" });
    fireEvent.click(within(dialog).getByRole("radio", { name: "ของแถม (ของค้างสต๊อก)" }));
    change(within(dialog).getByLabelText("ชื่อสินค้า"), "เคสใส");
    change(within(dialog).getByLabelText("รหัสสินค้า (SKU)"), "CASE-01");
    change(within(dialog).getByLabelText("ต้นทุนต่อชิ้น (ลูกค้าไม่เห็น)"), "8");
    change(within(dialog).getByLabelText("ลูกค้ารู้สึกว่าคุ้ม"), "40");
    change(within(dialog).getByLabelText("เหลือในสต๊อก"), "300");
    fireEvent.click(within(dialog).getByRole("button", { name: "เพิ่ม" }));
    await waitFor(() =>
      expect(actions.saveGift).toHaveBeenCalledWith({ sku: "CASE-01", name: "เคสใส", unitCost: 8, perceivedValue: 40, qtyAvailable: 300, enabled: true }),
    );
  });

  it("ลบสินค้า: ต้องยืนยันก่อน", async () => {
    const actions = renderWith();
    fireEvent.click(screen.getByRole("button", { name: "ลบสินค้านี้" }));
    const dialog = screen.getByRole("dialog", { name: "ลบสายชาร์จ Type-C 1 เมตร?" });
    expect(actions.deleteItem).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("button", { name: "ลบเลย" }));
    await waitFor(() => expect(actions.deleteItem).toHaveBeenCalledWith("product", "CBL-C-1M"));
  });

  it("เลือกของแถมในรายการ → แก้จำนวนสต๊อกแล้วบันทึก", async () => {
    const actions = renderWith();
    fireEvent.click(within(screen.getByRole("region", { name: "รายการสินค้า" })).getByRole("button", { name: /หัวชาร์จ 20W/ }));
    const panel = screen.getByRole("region", { name: "ตั้งค่าหัวชาร์จ 20W" });
    change(within(panel).getByLabelText("เหลือในสต๊อก"), "450");
    fireEvent.click(within(panel).getByRole("button", { name: "บันทึก" }));
    await waitFor(() =>
      expect(actions.saveGift).toHaveBeenCalledWith(expect.objectContaining({ sku: "ADP-20W", qtyAvailable: 450 }), "ADP-20W"),
    );
  });

  it("แก้ชื่อของแถมอย่างเดียว → ไม่ส่งจำนวนสต๊อกที่ค้างในหน้าจอ (ออเดอร์อาจหักไปแล้ว)", async () => {
    const actions = renderWith();
    fireEvent.click(within(screen.getByRole("region", { name: "รายการสินค้า" })).getByRole("button", { name: /หัวชาร์จ 20W/ }));
    const panel = screen.getByRole("region", { name: "ตั้งค่าหัวชาร์จ 20W" });
    change(within(panel).getByLabelText("ชื่อของแถม"), "หัวชาร์จ 20W ขาว");
    fireEvent.click(within(panel).getByRole("button", { name: "บันทึก" }));
    await waitFor(() =>
      expect(actions.saveGift).toHaveBeenCalledWith(expect.objectContaining({ name: "หัวชาร์จ 20W ขาว", qtyAvailable: null }), "ADP-20W"),
    );
  });

  it("แก้ค้างไว้แล้วกดไปของอื่น → ถามก่อน · ไม่ยืนยัน = อยู่หน้าเดิม ค่าที่แก้ยังอยู่", () => {
    renderWith();
    const ask = vi.spyOn(window, "confirm").mockReturnValue(false);
    change(input("ราคาขาย"), "155");
    fireEvent.click(within(screen.getByRole("region", { name: "รายการสินค้า" })).getByRole("button", { name: /หัวชาร์จ 20W/ }));
    expect(ask).toHaveBeenCalled();
    expect(input("ราคาขาย").value).toBe("155");
    ask.mockReturnValue(true);
    fireEvent.click(within(screen.getByRole("region", { name: "รายการสินค้า" })).getByRole("button", { name: /หัวชาร์จ 20W/ }));
    expect(screen.getByRole("region", { name: "ตั้งค่าหัวชาร์จ 20W" })).toBeInTheDocument();
    ask.mockRestore();
  });

  it("ใส่รูปสินค้า → อัปโหลดแล้วแสดงปุ่มเปลี่ยนรูป", async () => {
    const actions = renderWith();
    const file = new File([new Uint8Array([1, 2, 3])], "cable.png", { type: "image/png" });
    fireEvent.change(screen.getByLabelText("เลือกรูปสายชาร์จ Type-C 1 เมตร"), { target: { files: [file] } });
    await waitFor(() => expect(actions.uploadImage).toHaveBeenCalledTimes(1));
    const form = vi.mocked(actions.uploadImage).mock.calls[0][0];
    expect(form.get("kind")).toBe("product");
    expect(form.get("sku")).toBe("CBL-C-1M");
    expect(await screen.findByRole("button", { name: "เปลี่ยนรูป" })).toBeInTheDocument();
  });

  it("นำเข้า CSV → ตัวอย่างบอกเพิ่มใหม่/แก้ราคา → กดนำเข้า", async () => {
    const actions = renderWith();
    fireEvent.click(screen.getByRole("button", { name: "นำเข้าจาก Excel" }));
    const dialog = screen.getByRole("dialog", { name: "นำเข้าจาก Excel" });
    const csv = [
      "รหัสสินค้า,ชื่อสินค้า,ราคาขาย,ต้นทุน,ราคาพื้น",
      "CBL-L-1M,สาย Lightning,180,110,140",
      "CBL-C-1M,สายชาร์จ Type-C 1 เมตร,150,100,120",
    ].join("\n");
    fireEvent.change(within(dialog).getByLabelText("เลือกไฟล์สินค้า"), {
      target: { files: [new File([csv], "สินค้า.csv", { type: "text/csv" })] },
    });
    expect(await within(dialog).findByText("เพิ่มใหม่")).toBeInTheDocument();
    expect(within(dialog).getByText("แก้ราคา")).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "นำเข้า 2 รายการ" }));
    await waitFor(() => expect(actions.importCatalog).toHaveBeenCalledTimes(1));
    expect(vi.mocked(actions.importCatalog).mock.calls[0][0].map((r) => r.product.sku)).toEqual(["CBL-L-1M", "CBL-C-1M"]);
    expect(await within(dialog).findByRole("status")).toHaveTextContent("นำเข้าแล้ว 1 รายการ");
  });

  it("นำเข้า Excel ที่มีแถวผิด → ปุ่มนำเข้ากดไม่ได้ บอกแถวที่ผิด", async () => {
    const actions = renderWith({}, async () => [
      ["sku", "name", "list_price", "unit_cost", "floor_price"],
      ["X-1", "ของ X", 100, 120, 110],
    ]);
    fireEvent.click(screen.getByRole("button", { name: "นำเข้าจาก Excel" }));
    const dialog = screen.getByRole("dialog", { name: "นำเข้าจาก Excel" });
    fireEvent.change(within(dialog).getByLabelText("เลือกไฟล์สินค้า"), {
      target: { files: [new File([new Uint8Array([0x50, 0x4b])], "สินค้า.xlsx")] },
    });
    expect(await within(dialog).findByText(/ราคาพื้น: ราคาพื้นต้องไม่ต่ำกว่าต้นทุน/)).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "นำเข้า 1 รายการ" })).toBeDisabled();
    expect(actions.importCatalog).not.toHaveBeenCalled();
  });
});
