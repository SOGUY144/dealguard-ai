// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { OwnerChatView } from "@/lib/owner/chat-view";
import type { Recorder } from "@/components/chat/voice-input";
import { OwnerChatScreen, type OwnerChatTransport } from "../owner-chat";

const at = "2026-10-24T00:15:00.000Z";
const refundView: OwnerChatView = {
  chatId: "c1",
  mode: "human",
  buyerName: "คุณนก",
  escalation: {
    kind: "refund",
    brief: ["คุณนก ขอคืนเงิน", '"ของเสีย 50 ชิ้น ขอคืนเงิน"', "AI ไม่รับปากเรื่องคืนเงิน รอเฮียชัยตัดสิน"],
    status: "open",
    at,
  },
  messages: [
    { id: "b1", at, type: "buyer_text", text: "ของที่ส่งมาเสีย 50 ชิ้น ขอคืนเงินค่ะ", inputMode: "text" },
    { id: "a1", at, type: "ai_text", text: "ขอโทษด้วยครับคุณนก เรื่องคืนเงินเฮียชัยดูแลเองครับ" },
    { id: "h1", at, type: "handoff", subject: "ขอคืนเงิน" },
  ],
};

function setup(view: OwnerChatView = refundView, act = vi.fn<OwnerChatTransport["act"]>(async () => view)) {
  const transport: OwnerChatTransport = { act, load: vi.fn(async () => view) };
  render(<OwnerChatScreen initial={view} ownerName="เฮียชัย" transport={transport} connect={null} />);
  return { act };
}

describe("OwnerChatScreen (Owner-Chat)", () => {
  it("หัวบอกชื่อลูกค้า + ประเภทเรื่อง · สรุปจาก AI 3 บรรทัด · ข้อความลูกค้า/AI", () => {
    setup();
    expect(screen.getByRole("heading", { name: "คุณนก" })).toBeInTheDocument();
    expect(screen.getByText("ลูกค้า · ขอคืนเงิน")).toBeInTheDocument();
    const summary = screen.getByRole("region", { name: "สรุปจาก AI" });
    expect(within(summary).getAllByRole("listitem")).toHaveLength(3);
    const log = screen.getByRole("log");
    expect(within(log).getByText("ของที่ส่งมาเสีย 50 ชิ้น ขอคืนเงินค่ะ")).toBeInTheDocument();
    expect(within(log).getByText(/AI ส่งเรื่องนี้ให้คุณ · ขอคืนเงิน/)).toBeInTheDocument();
    expect(within(log).getByText("AI หยุดตอบแชตนี้ · คุณตอบลูกค้าเอง")).toBeInTheDocument();
  });

  it("พิมพ์ตอบ → ส่งในชื่อเถ้าแก่", async () => {
    const { act: send } = setup();
    fireEvent.change(screen.getByLabelText("พิมพ์ตอบคุณนก"), { target: { value: "ส่งรูปมาได้เลยครับ" } });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "ส่งข้อความ" })));
    expect(send).toHaveBeenCalledWith({ type: "reply", text: "ส่งรูปมาได้เลยครับ" });
    expect(screen.getByText("ตอบในชื่อเฮียชัย")).toBeInTheDocument();
  });

  it("คำตอบด่วนของเรื่องคืนเงิน (ตามดีไซน์) กดแล้วส่งเลย", async () => {
    const { act: send } = setup();
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "ขอรูปของที่เสียหน่อยครับ" })));
    expect(send).toHaveBeenCalledWith({ type: "reply", text: "ขอรูปของที่เสียหน่อยครับ" });
    expect(screen.getByRole("button", { name: "เดี๋ยวเฮียโทรกลับครับ" })).toBeInTheDocument();
  });

  it("ปิดเรื่อง / ให้ AI ตอบต่อ", async () => {
    const { act: send } = setup();
    await act(async () => fireEvent.click(screen.getByRole("button", { name: /ปิดเรื่องนี้/ })));
    expect(send).toHaveBeenCalledWith({ type: "resolve" });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: /ให้ AI ตอบต่อ/ })));
    expect(send).toHaveBeenCalledWith({ type: "handback" });
  });

  it("แชตที่ AI ตอบอยู่แล้ว → ปุ่มให้ AI ตอบต่อกดไม่ได้ · เรื่องที่ปิดแล้วไม่มีปุ่มปิดเรื่อง", () => {
    setup({ ...refundView, mode: "ai", escalation: { ...refundView.escalation!, status: "resolved" } });
    expect(screen.getByRole("button", { name: /ให้ AI ตอบต่อ/ })).toBeDisabled();
    expect(screen.queryByRole("button", { name: /ปิดเรื่องนี้/ })).not.toBeInTheDocument();
    expect(screen.getByText("ปิดเรื่องแล้ว")).toBeInTheDocument();
  });

  it("ส่งไม่สำเร็จ → บอก และคืนข้อความในช่องพิมพ์", async () => {
    setup(refundView, vi.fn(async () => Promise.reject(new Error("network"))));
    fireEvent.change(screen.getByLabelText("พิมพ์ตอบคุณนก"), { target: { value: "เดี๋ยวโทรหาครับ" } });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "ส่งข้อความ" })));
    expect(screen.getByRole("alert")).toHaveTextContent("ส่งไม่สำเร็จ");
    expect(screen.getByLabelText("พิมพ์ตอบคุณนก")).toHaveValue("เดี๋ยวโทรหาครับ");
  });

  it("ข้อความของเถ้าแก่ขึ้นฝั่งร้านพร้อมชื่อ (คุณ)", () => {
    setup({ ...refundView, messages: [...refundView.messages, { id: "o1", at, type: "owner_text", text: "ส่งรูปมาครับ" }] });
    expect(screen.getByText(/เฮียชัย \(คุณ\)/)).toBeInTheDocument();
    expect(screen.getByText("ส่งรูปมาครับ")).toBeInTheDocument();
  });
});

describe("ไมค์ของเถ้าแก่ — พูดแทนพิมพ์", () => {
  function setupVoice(transcript: string | Error) {
    const start = vi.fn(async () => {});
    const stop = vi.fn(async () => new Blob(["x"], { type: "audio/webm" }));
    const transcribe = vi.fn(async () => {
      if (transcript instanceof Error) throw transcript;
      return transcript;
    });
    const transport: OwnerChatTransport = { act: vi.fn(async () => refundView), load: vi.fn(async () => refundView) };
    render(
      <OwnerChatScreen
        initial={refundView}
        ownerName="เฮียชัย"
        transport={transport}
        connect={null}
        voiceInput
        voice={{ recorder: () => ({ start, stop, cancel: vi.fn() }), transcribe }}
      />,
    );
    return { start, stop, transcribe, act: transport.act };
  }

  it("กดอัด → กดอีกครั้ง → ข้อความที่พูดไปอยู่ในช่องตอบ (ยังไม่ส่ง ให้ตรวจก่อน)", async () => {
    const { start, transcribe, act } = setupVoice("เดี๋ยวเฮียโทรกลับครับ");
    const mic = screen.getByRole("button", { name: "พูดแทนพิมพ์" });
    fireEvent.click(mic);
    await waitFor(() => expect(start).toHaveBeenCalled());
    fireEvent.click(await screen.findByRole("button", { name: "หยุดอัดเสียง" }));
    await waitFor(() => expect(transcribe).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByLabelText(/พิมพ์ตอบ/)).toHaveValue("เดี๋ยวเฮียโทรกลับครับ"));
    expect(act).not.toHaveBeenCalled();
  });

  it("แปลงเสียงไม่ได้ → บอกให้ลองใหม่หรือพิมพ์แทน", async () => {
    setupVoice(new Error("503"));
    fireEvent.click(screen.getByRole("button", { name: "พูดแทนพิมพ์" }));
    fireEvent.click(await screen.findByRole("button", { name: "หยุดอัดเสียง" }));
    expect(await screen.findByText(/แปลงเสียงไม่สำเร็จ/)).toBeInTheDocument();
  });

  function renderWith(recorder: () => Recorder) {
    const transport: OwnerChatTransport = { act: vi.fn(async () => refundView), load: vi.fn(async () => refundView) };
    return render(
      <OwnerChatScreen
        initial={refundView}
        ownerName="เฮียชัย"
        transport={transport}
        connect={null}
        voiceInput
        voice={{ recorder, transcribe: vi.fn(async () => "x") }}
      />,
    );
  }

  it("ออกจากหน้าตอนกำลังอัด → ปิดไมค์ทันที (ไม่ค้างอัดเบื้องหลัง)", async () => {
    const cancel = vi.fn();
    const { unmount } = renderWith(() => ({ start: vi.fn(async () => {}), stop: vi.fn(), cancel }));
    fireEvent.click(screen.getByRole("button", { name: "พูดแทนพิมพ์" }));
    await screen.findByRole("button", { name: "หยุดอัดเสียง" });
    unmount();
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it("กดไมค์สองครั้งตอนเบราว์เซอร์ถามสิทธิ์ → อัดตัวเดียว", async () => {
    let allow: () => void = () => {};
    let made = 0;
    renderWith(() => {
      made++;
      return { start: vi.fn(() => new Promise<void>((r) => (allow = r))), stop: vi.fn(async () => new Blob(["x"])), cancel: vi.fn() };
    });
    const mic = screen.getByRole("button", { name: "พูดแทนพิมพ์" });
    fireEvent.click(mic);
    fireEvent.click(mic);
    await act(async () => allow());
    expect(made).toBe(1);
  });

  it("ไม่มีคีย์แปลงเสียง → ปุ่มไมค์กดไม่ได้", () => {
    render(<OwnerChatScreen initial={refundView} ownerName="เฮียชัย" transport={{ act: vi.fn(), load: vi.fn() }} connect={null} />);
    expect(screen.getByRole("button", { name: /พูดแทนพิมพ์/ })).toBeDisabled();
  });
});
