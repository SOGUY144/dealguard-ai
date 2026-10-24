// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

// ช่อง Realtime ต้องเข้าด้วยสิทธิ์ของผู้ใช้ — เข้าด้วยสิทธิ์ anon แล้ว RLS ตัดเหตุการณ์ทิ้งเงียบๆ (เปิดหน้าใหม่ session ยังโหลดไม่เสร็จ)
const calls: string[] = [];
let resolveSession: (s: { data: { session: { access_token: string } | null } }) => void = () => {};
const fake = {
  auth: { getSession: vi.fn(() => new Promise((r) => (resolveSession = r))) },
  realtime: { setAuth: vi.fn(async (t: string) => void calls.push(`setAuth:${t}`)) },
  channel: vi.fn(() => {
    calls.push("channel");
    const ch = { on: vi.fn(() => ch), subscribe: vi.fn(() => (calls.push("subscribe"), ch)) };
    return ch;
  }),
  removeChannel: vi.fn(async () => {}),
};
vi.mock("../client", () => ({ getSupabaseBrowserClient: () => fake }));

beforeEach(() => {
  calls.length = 0;
  vi.clearAllMocks();
});

describe("connect — เข้าช่อง Realtime ด้วยสิทธิ์ของผู้ใช้", () => {
  it("รอ session แล้วผูก token ก่อนเข้าช่อง (ไม่เข้าช่องก่อน session โหลดเสร็จ)", async () => {
    const { connectOrder } = await import("../live");
    connectOrder("o1")(vi.fn(), vi.fn());
    expect(fake.channel).not.toHaveBeenCalled();
    resolveSession({ data: { session: { access_token: "buyer-token" } } });
    await vi.waitFor(() => expect(calls).toContain("subscribe"));
    expect(calls).toEqual(["setAuth:buyer-token", "channel", "subscribe"]);
  });

  it("ออกจากหน้าก่อน session โหลดเสร็จ → ไม่เข้าช่องเลย", async () => {
    const { connectOrder } = await import("../live");
    const disconnect = connectOrder("o1")(vi.fn(), vi.fn());
    disconnect();
    resolveSession({ data: { session: { access_token: "buyer-token" } } });
    await new Promise((r) => setTimeout(r, 0));
    expect(fake.channel).not.toHaveBeenCalled();
  });
});
