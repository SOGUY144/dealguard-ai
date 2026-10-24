// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useContext } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ConnectLive } from "@/components/live/use-live-updates";
import { MOCK_OFFERS } from "@/lib/chat/mock-offers";
import type { PendingOrder } from "@/lib/owner/summary";
import { OrderAlertsProvider, PendingCountContext } from "../order-alerts";

const { refresh, router } = vi.hoisted(() => {
  const refresh = vi.fn();
  return { refresh, router: { refresh } };
});
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const order = (id: string, buyerName: string, letter: 0 | 1 = 1): PendingOrder => ({
  id,
  chatId: `chat-${id}`,
  at: "2026-10-25T03:00:00.000Z",
  buyerName,
  productName: "สายชาร์จ Type-C 1 เมตร",
  offer: MOCK_OFFERS[letter],
});

/** Realtime ปลอม: ต่อติดทันที · fire() = มีออเดอร์เปลี่ยน */
let fire: () => void = () => {};
const connect: ConnectLive = (onChange, onStatus) => {
  fire = onChange;
  onStatus("live");
  return () => {};
};

function Count() {
  return <span data-testid="count">{useContext(PendingCountContext)}</span>;
}

let pending: PendingOrder[];
const load = vi.fn(async () => pending);
const confirm = vi.fn(async (id: string) => {
  pending = pending.filter((o) => o.id !== id);
  return { ok: true as const, confirmedAt: "2026-10-25T03:20:00.000Z" };
});

function setup() {
  render(
    <OrderAlertsProvider load={load} confirm={confirm} connect={connect}>
      <Count />
    </OrderAlertsProvider>,
  );
}

const alerts = () => screen.getByRole("region", { name: "การแจ้งเตือนออเดอร์" });

beforeEach(() => {
  vi.clearAllMocks();
  pending = [order("old", "คุณเก่า")];
});

describe("OrderAlerts — ลูกค้าปิดดีล → เด้งบนจอเถ้าแก่ทุกหน้า", () => {
  it("เปิดหน้าครั้งแรก: ไม่เด้งออเดอร์ที่รออยู่ก่อนแล้ว แต่นับเข้า badge", async () => {
    setup();
    await waitFor(() => expect(screen.getByTestId("count")).toHaveTextContent("1"));
    expect(within(alerts()).queryByRole("article")).not.toBeInTheDocument();
  });

  it("ออเดอร์ใหม่เข้ามา → เด้งบอกลูกค้า สินค้า ยอด · กดยืนยันได้ทันที หรือไปดูแชต", async () => {
    setup();
    await waitFor(() => expect(load).toHaveBeenCalled());
    pending = [order("new", "คุณนก"), ...pending];
    await act(async () => fire());
    const toast = await within(alerts()).findByRole("article", { name: "ลูกค้าปิดดีลแล้ว · คุณนก" });
    expect(toast).toHaveTextContent("คุณนก · สายชาร์จ Type-C 1 เมตร");
    expect(toast).toHaveTextContent("฿135 × 1,000 = ฿135,000 · โอนทันที");
    expect(within(toast).getByRole("link", { name: "ดูแชตของคุณนก" })).toHaveAttribute("href", "/owner/chats/chat-new");
    expect(screen.getByTestId("count")).toHaveTextContent("2");

    await act(async () => fireEvent.click(within(toast).getByRole("button", { name: "ยืนยันออเดอร์ · คุณนก" })));
    expect(confirm).toHaveBeenCalledWith("new");
    expect(toast).toHaveTextContent("ยืนยันแล้ว · ลูกค้าเห็น QR แล้ว");
    expect(refresh).toHaveBeenCalled();
  });

  it("กดปิด → หายไป · ไม่เด้งซ้ำตอนมีการเปลี่ยนแปลงครั้งถัดไป", async () => {
    setup();
    await waitFor(() => expect(load).toHaveBeenCalled());
    pending = [order("new", "คุณนก"), ...pending];
    await act(async () => fire());
    const toast = await within(alerts()).findByRole("article", { name: "ลูกค้าปิดดีลแล้ว · คุณนก" });
    fireEvent.click(within(toast).getByRole("button", { name: "ปิดการแจ้งเตือน · คุณนก" }));
    expect(within(alerts()).queryByRole("article")).not.toBeInTheDocument();
    const before = load.mock.calls.length;
    await act(async () => fire());
    await waitFor(() => expect(load.mock.calls.length).toBeGreaterThan(before));
    expect(within(alerts()).queryByRole("article")).not.toBeInTheDocument();
  });

  it("ยืนยันจากอีกแท็บ / หน้าออเดอร์ → การแจ้งเตือนของออเดอร์นั้นหายเอง", async () => {
    setup();
    await waitFor(() => expect(load).toHaveBeenCalled());
    pending = [order("new", "คุณนก"), ...pending];
    await act(async () => fire());
    await within(alerts()).findByRole("article", { name: "ลูกค้าปิดดีลแล้ว · คุณนก" });
    pending = pending.filter((o) => o.id !== "new");
    await act(async () => fire());
    await waitFor(() => expect(within(alerts()).queryByRole("article")).not.toBeInTheDocument());
  });

  it("ยืนยันไม่สำเร็จ → บอกในการแจ้งเตือน กดใหม่ได้", async () => {
    confirm.mockResolvedValueOnce({ ok: false, error: "บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง" } as never);
    setup();
    await waitFor(() => expect(load).toHaveBeenCalled());
    pending = [order("new", "คุณนก"), ...pending];
    await act(async () => fire());
    const toast = await within(alerts()).findByRole("article", { name: "ลูกค้าปิดดีลแล้ว · คุณนก" });
    await act(async () => fireEvent.click(within(toast).getByRole("button", { name: "ยืนยันออเดอร์ · คุณนก" })));
    expect(within(toast).getByRole("alert")).toHaveTextContent("บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง");
    expect(within(toast).getByRole("button", { name: "ยืนยันออเดอร์ · คุณนก" })).toBeEnabled();
  });
});
