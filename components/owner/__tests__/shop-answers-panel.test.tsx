// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ShopAnswersPanel } from "../shop-answers-panel";

const initial = { delivery: "ส่งภายใน 1–2 วันทำการ", stock: "" };

describe("ShopAnswersPanel — คำตอบให้ลูกค้า (ใช้ทั้งร้าน)", () => {
  it("แก้แล้วกดบันทึก → ส่งค่าที่ตัดช่องว่างแล้ว · บอกว่าบันทึกแล้ว", async () => {
    const save = vi.fn(async () => ({ ok: true as const }));
    render(<ShopAnswersPanel initial={initial} save={save} />);
    fireEvent.change(screen.getByLabelText(/สต๊อก/), { target: { value: "  มีพร้อมส่งทุกตัว  " } });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "บันทึกคำตอบ" })));
    expect(save).toHaveBeenCalledWith({ delivery: "ส่งภายใน 1–2 วันทำการ", stock: "มีพร้อมส่งทุกตัว" });
    expect(screen.getByRole("status")).toHaveTextContent(/บันทึกแล้ว/);
  });

  it("ยาวเกิน → บอกตรงช่อง ไม่ส่ง", async () => {
    const save = vi.fn();
    render(<ShopAnswersPanel initial={initial} save={save} />);
    fireEvent.change(screen.getByLabelText(/การส่งของ/), { target: { value: "ก".repeat(301) } });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "บันทึกคำตอบ" })));
    expect(save).not.toHaveBeenCalled();
    expect(screen.getByText("ไม่เกิน 300 ตัวอักษร")).toBeInTheDocument();
  });

  it("ช่องว่างบอกว่าผู้ช่วยจะทำอะไร (ลูกค้าถามแล้วยังตอบไม่ได้)", () => {
    render(<ShopAnswersPanel initial={initial} save={vi.fn()} />);
    expect(screen.getByLabelText(/สต๊อก/)).toHaveAccessibleDescription(/ว่างไว้ = ผู้ช่วยบอกลูกค้าให้กด "คุยกับคนจริง"/);
  });

  it("บันทึกไม่สำเร็จ → บอกให้ลองใหม่ ค่าที่พิมพ์ยังอยู่", async () => {
    const save = vi.fn(async () => {
      throw new Error("503");
    });
    render(<ShopAnswersPanel initial={initial} save={save} />);
    fireEvent.change(screen.getByLabelText(/สต๊อก/), { target: { value: "มีของ" } });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "บันทึกคำตอบ" })));
    expect(screen.getByRole("alert")).toHaveTextContent("บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง");
    expect(screen.getByLabelText(/สต๊อก/)).toHaveValue("มีของ");
  });
});
