// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { FormAction, FormState } from "@/lib/auth/form-state";
import { ForgotPasswordForm } from "../forgot-password-form";
import { LoginForm } from "../login-form";
import { SignupForm } from "../signup-form";

vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams("next=%2Fowner") }));

const fakeAction = (result: FormState) => vi.fn<FormAction>(async () => result);

describe("LoginForm", () => {
  it("มีช่องที่มี label ครบ และลิงก์ไปสมัคร/ลืมรหัสผ่าน", () => {
    render(<LoginForm action={fakeAction({})} />);
    expect(screen.getByLabelText("อีเมล")).toHaveAttribute("type", "email");
    expect(screen.getByLabelText("รหัสผ่าน")).toHaveAttribute("type", "password");
    expect(screen.getByRole("link", { name: "สมัครสมาชิก" })).toHaveAttribute("href", "/signup");
    expect(screen.getByRole("link", { name: "ลืมรหัสผ่าน?" })).toHaveAttribute("href", "/forgot-password");
  });

  it("ส่งอีเมล รหัสผ่าน และหน้าที่จะกลับไป (next)", async () => {
    const action = fakeAction({});
    render(<LoginForm action={action} />);
    await userEvent.type(screen.getByLabelText("อีเมล"), "nok@example.com");
    await userEvent.type(screen.getByLabelText("รหัสผ่าน"), "secret-123");
    fireEvent.click(screen.getByRole("button", { name: "เข้าสู่ระบบ" }));

    await waitFor(() => expect(action).toHaveBeenCalled());
    const form = action.mock.calls[0][1];
    expect(form.get("email")).toBe("nok@example.com");
    expect(form.get("password")).toBe("secret-123");
    expect(form.get("next")).toBe("/owner");
  });

  it("แสดง error รวม และ error ข้างช่องที่ผิด", async () => {
    render(
      <LoginForm
        action={fakeAction({ error: "อีเมลหรือรหัสผ่านไม่ถูกต้อง", fieldErrors: { password: "กรอกรหัสผ่าน" } })}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "เข้าสู่ระบบ" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("อีเมลหรือรหัสผ่านไม่ถูกต้อง");
    expect(screen.getByLabelText("รหัสผ่าน")).toHaveAccessibleDescription("กรอกรหัสผ่าน");
    expect(screen.getByLabelText("รหัสผ่าน")).toHaveAttribute("aria-invalid", "true");
  });
});

describe("SignupForm", () => {
  it("มีช่องชื่อ อีเมล รหัสผ่าน และช่องติ๊กยอมรับนโยบายที่ลิงก์ไปหน้า /privacy", () => {
    render(<SignupForm action={fakeAction({})} />);
    expect(screen.getByLabelText("ชื่อที่ให้ร้านเรียก")).toBeInTheDocument();
    expect(screen.getByLabelText("อีเมล")).toBeInTheDocument();
    expect(screen.getByLabelText("รหัสผ่าน")).toHaveAttribute("autocomplete", "new-password");
    expect(screen.getByRole("checkbox", { name: /ยอมรับนโยบายความเป็นส่วนตัว/ })).not.toBeChecked();
    expect(screen.getByRole("link", { name: "นโยบายความเป็นส่วนตัว" })).toHaveAttribute("href", "/privacy");
  });

  it("สมัครแล้วต้องยืนยันอีเมล → บอกให้เช็กอีเมล", async () => {
    render(<SignupForm action={fakeAction({ notice: "ส่งลิงก์ยืนยันไปที่ nok@example.com แล้ว" })} />);
    fireEvent.click(screen.getByRole("button", { name: "สมัครสมาชิก" }));
    expect(await screen.findByRole("status")).toHaveTextContent("ส่งลิงก์ยืนยันไปที่ nok@example.com แล้ว");
  });
});

describe("ForgotPasswordForm", () => {
  it("ขอลิงก์ตั้งรหัสใหม่ แล้วบอกผลโดยไม่เปิดเผยว่ามีบัญชีไหม", async () => {
    render(<ForgotPasswordForm action={fakeAction({ notice: "ถ้ามีบัญชีนี้ เราส่งลิงก์ไปแล้ว" })} />);
    await userEvent.type(screen.getByLabelText("อีเมล"), "nok@example.com");
    fireEvent.click(screen.getByRole("button", { name: "ส่งลิงก์ตั้งรหัสผ่านใหม่" }));
    expect(await screen.findByRole("status")).toHaveTextContent("ถ้ามีบัญชีนี้ เราส่งลิงก์ไปแล้ว");
  });
});
