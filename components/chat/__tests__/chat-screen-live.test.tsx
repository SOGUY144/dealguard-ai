// @vitest-environment jsdom
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatAction, ChatView } from "@/lib/chat/actions";
import { MOCK_OFFERS } from "@/lib/chat/mock-offers";
import type { ChatMessage, Storefront } from "@/lib/chat/types";
import { ChatScreen } from "../chat-screen";

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
const at = "2026-10-23T07:30:00.000Z";

const greeting: ChatMessage = { id: "g", at, type: "ai_text", text: "สวัสดีครับ ผู้ช่วย AI ของเฮียชัยครับ", cta: "open_products" };
const initialView: ChatView = { messages: [greeting], suggestions: [], mode: "ai" };
const withOffers: ChatView = {
  mode: "ai",
  suggestions: [],
  messages: [
    greeting,
    { id: "b1", at, type: "buyer_text", text: "ขอ 125 ได้ไหม 1000 ชิ้น", inputMode: "text" },
    { id: "a1", at, type: "ai_text", text: "สวัสดีครับคุณนก ราคา 125 ที่ 1,000 ชิ้นเฮียชัยให้ไม่ไหว แต่มี 3 ทางให้เลือกครับ" },
    { id: "o1", at, type: "offers", sku: "CBL-C-1M", offers: MOCK_OFFERS },
  ],
};

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: true,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
  Element.prototype.scrollIntoView = vi.fn();
});

function renderLive(view: ChatView, transport: (a: ChatAction) => Promise<ChatView>) {
  return render(
    <ChatScreen storefront={storefront} products={products} buyerName="คุณนก" live={{ initialView: view, transport }} />,
  );
}

const thread = () => screen.getByRole("log");
const typeAndSend = (text: string) => {
  fireEvent.change(screen.getByLabelText("พิมพ์ข้อความ"), { target: { value: text } });
  fireEvent.click(screen.getByRole("button", { name: "ส่งข้อความ" }));
};

describe("ChatScreen — แชตจริง (ผ่าน API)", () => {
  it("แสดงแชตที่ server โหลดมา", () => {
    renderLive(initialView, vi.fn());
    expect(within(thread()).getByText(/ผู้ช่วย AI ของเฮียชัยครับ/)).toBeInTheDocument();
  });

  it("พิมพ์ส่ง → ข้อความขึ้นทันที + กำลังตอบ → ได้คำตอบจาก server", async () => {
    const reply = deferred<ChatView>();
    const transport = vi.fn(() => reply.promise);
    renderLive(initialView, transport);

    typeAndSend("ขอ 125 ได้ไหม 1000 ชิ้น");
    expect(transport).toHaveBeenCalledWith({ type: "send", text: "ขอ 125 ได้ไหม 1000 ชิ้น", inputMode: "text" });
    expect(within(thread()).getByText("ขอ 125 ได้ไหม 1000 ชิ้น")).toBeInTheDocument();
    expect(screen.getByRole("status", { name: "ผู้ช่วยกำลังตอบ" })).toBeInTheDocument();

    await act(async () => reply.resolve(withOffers));
    expect(within(thread()).getByRole("group", { name: "3 ทางเลือกจากเฮียชัย" })).toBeInTheDocument();
    expect(screen.queryByRole("status", { name: "ผู้ช่วยกำลังตอบ" })).not.toBeInTheDocument();
    expect(within(thread()).getAllByText("ขอ 125 ได้ไหม 1000 ชิ้น")).toHaveLength(1);
  });

  it("ระหว่างรอคำตอบ ส่งซ้ำไม่ได้", async () => {
    const reply = deferred<ChatView>();
    const transport = vi.fn(() => reply.promise);
    renderLive(initialView, transport);
    typeAndSend("ข้อความแรก");
    typeAndSend("ข้อความสอง");
    expect(transport).toHaveBeenCalledTimes(1);
    await act(async () => reply.resolve(initialView));
  });

  it("เลือกข้อเสนอในเครื่อง (ไม่ยิง API) แล้วยืนยัน → ส่ง id ของข้อเสนอไป server", async () => {
    const transport = vi.fn(async () => withOffers);
    renderLive(withOffers, transport);
    const group = within(thread()).getByRole("group", { name: "3 ทางเลือกจากเฮียชัย" });
    fireEvent.click(within(group).getAllByRole("button")[1]);
    expect(transport).not.toHaveBeenCalled();

    await act(async () => fireEvent.click(screen.getByRole("button", { name: "ยืนยันข้อ B · ฿135,000" })));
    expect(transport).toHaveBeenCalledWith({ type: "confirm_offer", messageId: "o1", offerId: "B" });
  });

  it("server ชี้ข้อเสนอ (ลูกค้าพิมพ์ 'สั่ง 1,500 ชิ้น') → เลือกข้อ A ให้ พร้อมปุ่มยืนยัน", async () => {
    const transport = vi.fn(async () => ({ ...withOffers, focus: { messageId: "o1", offerId: "A" as const } }));
    renderLive(withOffers, transport);
    await act(async () => typeAndSend("สั่ง 1,500 ชิ้น"));
    expect(screen.getByRole("button", { name: "ยืนยันข้อ A · ฿195,000" })).toBeInTheDocument();
  });

  it("ข้อเสนอที่เลือกไว้ยังอยู่หลังได้คำตอบใหม่", async () => {
    const transport = vi.fn(async () => withOffers);
    renderLive(withOffers, transport);
    const group = within(thread()).getByRole("group", { name: "3 ทางเลือกจากเฮียชัย" });
    fireEvent.click(within(group).getAllByRole("button")[2]);
    await act(async () => typeAndSend("ขอบคุณครับ"));
    expect(screen.getByRole("button", { name: "ยืนยันข้อ C · ฿145,000" })).toBeInTheDocument();
  });

  it("ส่งไม่สำเร็จ → บอกให้ลองใหม่ และคืนข้อความไว้ในช่องพิมพ์", async () => {
    const transport = vi.fn(async () => {
      throw new Error("network");
    });
    renderLive(initialView, transport);
    await act(async () => typeAndSend("ขอ 125 ได้ไหม"));
    expect(within(thread()).getByText(/ส่งไม่สำเร็จ/)).toBeInTheDocument();
    expect(within(thread()).queryByText("ขอ 125 ได้ไหม")).not.toBeInTheDocument();
    expect(screen.getByLabelText("พิมพ์ข้อความ")).toHaveValue("ขอ 125 ได้ไหม");
  });

  it("ระหว่างรอคำตอบ ปุ่มที่ส่งคำขอไป server กดไม่ได้ (ไม่เงียบหายเฉยๆ)", async () => {
    const reply = deferred<ChatView>();
    const transport = vi.fn(() => reply.promise);
    const picked: ChatView = {
      ...withOffers,
      messages: withOffers.messages.map((m) => (m.type === "offers" ? { ...m, selectedId: "B" as const } : m)),
    };
    renderLive(picked, transport);
    typeAndSend("รอก่อนนะ");

    expect(screen.getByRole("button", { name: "ยืนยันข้อ B · ฿135,000" })).toBeDisabled();
    expect(screen.getByRole("button", { name: /คุยกับคนจริง/ })).toBeDisabled();
    const drawer = screen.getByRole("complementary", { name: "สินค้าในร้าน" });
    expect(within(drawer).getByRole("button", { name: "ขอต่อราคา" })).toBeDisabled();
    await act(async () => reply.resolve(picked));
    expect(screen.getByRole("button", { name: "ยืนยันข้อ B · ฿135,000" })).toBeEnabled();
  });

  it("server ยืนยันข้อเสนอไม่ได้ (เก่า/ยืนยันไปแล้ว) → บอกลูกค้า ไม่เงียบ", async () => {
    const transport = vi.fn(async () => ({ ...withOffers, notice: "confirm_unavailable" as const }));
    const picked: ChatView = {
      ...withOffers,
      messages: withOffers.messages.map((m) => (m.type === "offers" ? { ...m, selectedId: "A" as const } : m)),
    };
    renderLive(picked, transport);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "ยืนยันข้อ A · ฿195,000" })));
    expect(within(thread()).getByText(/ยืนยันไม่ได้แล้ว/)).toBeInTheDocument();
  });

  it("ไมค์ยังใช้ในแชตจริงไม่ได้ (เฟส 6) — กดไม่ได้ ไม่ส่งประโยคเดโมเข้าแชต", () => {
    const transport = vi.fn();
    renderLive(initialView, transport);
    const mic = screen.getByRole("button", { name: /พูดด้วยเสียง/ });
    expect(mic).toBeDisabled();
    fireEvent.click(mic);
    expect(transport).not.toHaveBeenCalled();
  });

  it("เลือกสินค้าจาก drawer → ส่ง pick_product", async () => {
    const transport = vi.fn(async () => initialView);
    renderLive(initialView, transport);
    const drawer = screen.getByRole("complementary", { name: "สินค้าในร้าน" });
    await act(async () => fireEvent.click(within(drawer).getByRole("button", { name: "ขอต่อราคา" })));
    expect(transport).toHaveBeenCalledWith({ type: "pick_product", sku: "CBL-C-1M" });
  });
});
