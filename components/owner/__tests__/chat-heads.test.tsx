// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ConnectLive } from "@/components/live/use-live-updates";
import type { ChatHeadSource } from "@/lib/owner/chat-heads";
import { ChatHeads, openChatOf } from "../chat-heads";

const nav = vi.hoisted(() => ({ pathname: "/owner" }));
vi.mock("next/navigation", () => ({ usePathname: () => nav.pathname }));

/** Realtime ปลอม: ต่อติดทันที · fire() = มีข้อความใหม่ */
let fire: () => void = () => {};
const connect: ConnectLive = (onChange, onStatus) => {
  fire = onChange;
  onStatus("live");
  return () => {};
};

const src = (chatId: string, buyerName: string, lastId: string, text: string, needsOwner = false): ChatHeadSource => ({
  chatId,
  buyerName,
  needsOwner,
  lastBuyer: { id: lastId, text },
  subject: needsOwner ? "ขอคืนเงิน" : null,
});

let sources: ChatHeadSource[];
const load = vi.fn(async (): Promise<ChatHeadSource[] | null> => sources);
const region = () => screen.getByRole("region", { name: "ลูกค้าที่ทักเข้ามา" });

async function tick() {
  // debounce ของ useLiveUpdates 300ms + promise ของ load
  await act(async () => {
    await new Promise((r) => setTimeout(r, 350));
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  nav.pathname = "/owner";
  sources = [src("a", "คุณแอน", "m1", "ขอ 125 ได้ไหม"), src("s", "SOGUY", "m2", "ขอคืนเงินครับ", true)];
});

describe("ChatHeads — หัวแชตลอยแบบ Messenger", () => {
  it("เปิดหน้า: แชตที่รอเถ้าแก่ขึ้นเป็นวงกลม (ไม่เด้งข้อความเก่าของแชตอื่น)", async () => {
    render(<ChatHeads load={load} connect={connect} />);
    const head = await within(region()).findByRole("link", { name: /เปิดแชต SOGUY · รอคุณตัดสิน \(ขอคืนเงิน\)/ });
    expect(head).toHaveAttribute("href", "/owner/chats/s");
    expect(within(region()).queryByRole("link", { name: /คุณแอน/ })).toBeNull();
  });

  it("ลูกค้าทักใหม่ → วงกลมเด้งพร้อมกล่องข้อความและจำนวนข้อความใหม่", async () => {
    render(<ChatHeads load={load} connect={connect} />);
    await within(region()).findByRole("link", { name: /SOGUY/ });
    sources = [src("a", "คุณแอน", "m3", "ไม่ซื้อเพิ่มครับ"), sources[1]];
    fire();
    await tick();
    const head = await within(region()).findByRole("link", { name: "เปิดแชต คุณแอน · 1 ข้อความใหม่: ไม่ซื้อเพิ่มครับ" });
    expect(head).toHaveAttribute("href", "/owner/chats/a");
    expect(within(region()).getByText("ไม่ซื้อเพิ่มครับ")).toBeInTheDocument();
  });

  it("กดซ่อน → วงกลมหาย", async () => {
    render(<ChatHeads load={load} connect={connect} />);
    await within(region()).findByRole("link", { name: /SOGUY/ });
    fireEvent.click(screen.getByRole("button", { name: "ซ่อนหัวแชต SOGUY" }));
    expect(within(region()).queryByRole("link", { name: /SOGUY/ })).toBeNull();
  });

  it("อยู่ในหน้าแชตของคนนั้นเอง → ไม่มีวงกลมของคนนั้น", async () => {
    nav.pathname = "/owner/chats/s";
    render(<ChatHeads load={load} connect={connect} />);
    await waitFor(() => expect(load).toHaveBeenCalled());
    await tick();
    expect(within(region()).queryByRole("link", { name: /SOGUY/ })).toBeNull();
  });

  it("อ่านข้อมูลไม่ได้ (null) → ไม่เด้งอะไร และรอบถัดไปไม่ถือว่าทุกแชตเป็นของใหม่", async () => {
    load.mockResolvedValueOnce(null);
    sources = [src("a", "คุณแอน", "m1", "ขอ 125 ได้ไหม")];
    render(<ChatHeads load={load} connect={connect} />);
    await tick();
    fire();
    await tick();
    expect(within(region()).queryAllByRole("link")).toHaveLength(0);
  });
});

describe("ChatHeads — ไม่ดึงวน", () => {
  it("layout ส่ง load ตัวใหม่มาทุกครั้งที่ render (หลัง server action) → ไม่ดึงซ้ำ ดึงเฉพาะตอนเปิดหน้า/มีข้อความใหม่", async () => {
    const { rerender } = render(<ChatHeads load={load} connect={connect} />);
    await tick();
    const calls = load.mock.calls.length;
    for (let i = 0; i < 3; i++) {
      rerender(<ChatHeads load={async () => load()} connect={connect} />);
      await tick();
    }
    expect(load.mock.calls.length).toBe(calls);
    fire();
    await tick();
    expect(load.mock.calls.length).toBe(calls + 1);
  });
});

describe("openChatOf", () => {
  it.each([
    ["/owner/chats/abc", "abc"],
    ["/owner/chats/abc/", "abc"],
    ["/owner", null],
    ["/owner/escalations", null],
    [null, null],
  ])("%s → %s", (path, id) => {
    expect(openChatOf(path)).toBe(id);
  });
});
