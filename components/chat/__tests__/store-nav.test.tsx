// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChatHeader } from "../chat-header";
import { StoreHeader } from "../store-header";
import { TalkToOwnerButton } from "../talk-to-owner-button";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

afterEach(() => {
  vi.unstubAllGlobals();
  push.mockClear();
});

describe("StoreHeader (คอม) — เมนูร้านกดได้ทุกอัน", () => {
  it("แชตต่อราคา / วิธีสั่งซื้อ / ติดต่อร้าน เป็นลิงก์จริง หน้าปัจจุบันมี aria-current", () => {
    render(<StoreHeader storeName="ร้านเฮียชัยโมบาย" tagline="ขายส่ง" current="how" />);
    const nav = screen.getByRole("navigation", { name: "เมนูร้าน" });
    expect(within(nav).getByRole("link", { name: "แชตต่อราคา" })).toHaveAttribute("href", "/");
    expect(within(nav).getByRole("link", { name: "วิธีสั่งซื้อ" })).toHaveAttribute("href", "/how-to-order");
    expect(within(nav).getByRole("link", { name: "วิธีสั่งซื้อ" })).toHaveAttribute("aria-current", "page");
    expect(within(nav).getByRole("link", { name: "ติดต่อร้าน" })).toHaveAttribute("href", "/contact");
    expect(within(nav).getByRole("link", { name: "แชตต่อราคา" })).not.toHaveAttribute("aria-current");
  });
});

describe("ChatHeader (มือถือ) — เมนู", () => {
  it("กดเมนู → วิธีสั่งซื้อ / ติดต่อร้าน / นโยบาย / ออกจากระบบ · Esc ปิด", () => {
    render(<ChatHeader assistantName="ผู้ช่วย AI ของเฮียชัย" onTalkToHuman={() => {}} canLogout />);
    const toggle = screen.getByRole("button", { name: "เมนู" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    const menu = screen.getByRole("navigation", { name: "เมนูร้าน (มือถือ)" });
    expect(within(menu).getByRole("link", { name: "วิธีสั่งซื้อ" })).toHaveAttribute("href", "/how-to-order");
    expect(within(menu).getByRole("link", { name: "ติดต่อร้าน" })).toHaveAttribute("href", "/contact");
    expect(within(menu).getByRole("link", { name: "นโยบายความเป็นส่วนตัว" })).toHaveAttribute("href", "/privacy");
    expect(within(menu).getByRole("button", { name: "ออกจากระบบ" }).closest("form")).toHaveAttribute("action", "/auth/logout");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("navigation", { name: "เมนูร้าน (มือถือ)" })).not.toBeInTheDocument();
  });
});

describe("TalkToOwnerButton (ใบสรุปออเดอร์ / ติดต่อร้าน)", () => {
  const stubFetch = (status: number) => {
    const fetchMock = vi.fn(async () => new Response("{}", { status }));
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  };

  it("ส่งเรื่องให้เถ้าแก่ผ่าน API แชต แล้วพากลับไปหน้าแชต", async () => {
    const fetchMock = stubFetch(200);
    render(<TalkToOwnerButton ownerName="เฮียชัย" />);
    fireEvent.click(screen.getByRole("button", { name: "คุยกับเฮียชัยโดยตรง" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/"));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/chat",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ type: "talk_to_human" }) }),
    );
  });

  it("ยังไม่ล็อกอิน → ไปหน้าล็อกอิน", async () => {
    stubFetch(401);
    render(<TalkToOwnerButton ownerName="เฮียชัย" />);
    fireEvent.click(screen.getByRole("button", { name: "คุยกับเฮียชัยโดยตรง" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/login?next=%2Fcontact"));
  });

  it("บัญชีเถ้าแก่ / ระบบล่ม → บอกเหตุผล ไม่พาไปไหน", async () => {
    stubFetch(403);
    render(<TalkToOwnerButton ownerName="เฮียชัย" />);
    fireEvent.click(screen.getByRole("button", { name: "คุยกับเฮียชัยโดยตรง" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("ใช้ได้เฉพาะบัญชีลูกค้า");
    expect(push).not.toHaveBeenCalled();
  });
});
