// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { FormAction, FormState } from "@/lib/auth/form-state";
import { welcomeStore } from "@/lib/welcome/store";
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
    // JS ทำงาน → บอก server ให้ตอบ welcome (เล่นคัตซีน) แทน redirect
    expect(form.get("js")).toBe("1");
  });

  it("บัญชีทดลอง: โชว์อีเมลกับรหัส และกดแล้วกรอกให้ ส่งเข้าระบบได้เลย", async () => {
    const action = fakeAction({});
    render(<LoginForm action={action} demoAccount={{ email: "demo@example.com", password: "demo-pass-1" }} />);
    expect(screen.getByText("demo@example.com")).toBeInTheDocument();
    expect(screen.getByText("demo-pass-1")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "ใช้บัญชีทดลอง" }));
    expect(screen.getByLabelText("อีเมล")).toHaveValue("demo@example.com");
    expect(screen.getByLabelText("รหัสผ่าน")).toHaveValue("demo-pass-1");
    fireEvent.click(screen.getByRole("button", { name: "เข้าสู่ระบบ" }));
    await waitFor(() => expect(action).toHaveBeenCalled());
    expect(action.mock.calls[0][1].get("email")).toBe("demo@example.com");
  });

  it("ไม่มีบัญชีทดลอง → ไม่มีกล่องบัญชีทดลอง", () => {
    render(<LoginForm action={fakeAction({})} />);
    expect(screen.queryByRole("button", { name: "ใช้บัญชีทดลอง" })).not.toBeInTheDocument();
  });

  it("ล็อกอินผ่าน → สั่งเล่นคัตซีนต้อนรับพร้อมหน้าปลายทาง", async () => {
    const welcome = { to: "/owner", name: "เฮียชัย", role: "owner" as const };
    render(<LoginForm action={fakeAction({ welcome })} />);
    fireEvent.click(screen.getByRole("button", { name: "เข้าสู่ระบบ" }));
    await waitFor(() => expect(welcomeStore.get()).toEqual(welcome));
    welcomeStore.finish();
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
