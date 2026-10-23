import { describe, expect, it } from "vitest";
import { buildScenario, SCENARIOS } from "../scenarios";
import type { MockContext } from "../mock-responder";

const ctx: Omit<MockContext, "now"> = {
  storefront: {
    storeName: "ร้านเฮียชัยโมบาย",
    tagline: "ขายส่งอุปกรณ์มือถือ",
    ownerName: "เฮียชัย",
    assistantName: "ผู้ช่วย AI ของเฮียชัย",
    bankAccountName: "[ชื่อบัญชีร้าน]",
    contactChannel: "[ช่องทางติดต่อของร้าน]",
    orderRefPlaceholder: "[เลขออเดอร์]",
  },
  products: [{ sku: "CBL-C-1M", name: "สายชาร์จ Type-C 1 เมตร", listPrice: 150 }],
  buyerName: "คุณนก",
};

const lastTypes = (name: (typeof SCENARIOS)[number], n: number) =>
  buildScenario(name, ctx)
    .messages.slice(-n)
    .map((m) => (m.type === "system" ? `system:${m.kind}` : m.type));

describe("buildScenario — ทุก state ในไฟล์ดีไซน์", () => {
  it("มีครบทุกจอ", () => {
    expect(SCENARIOS).toEqual(["start", "product", "offers", "ordered", "text", "novoice", "guard", "escalate"]);
  });

  it("start = Main ตอนเริ่ม", () => expect(lastTypes("start", 1)).toEqual(["ai_text"]));
  it("product = เลือกสินค้าแล้ว", () => expect(lastTypes("product", 2)).toEqual(["product_card", "ai_text"]));
  it("offers = ตอบเสียง + ข้อเสนอ และเลือก A ไว้", () => {
    expect(lastTypes("offers", 2)).toEqual(["ai_voice", "offers"]);
    const offers = buildScenario("offers", ctx).messages.at(-1);
    expect(offers?.type === "offers" && offers.selectedId).toBe("A");
  });
  it("ordered = ยืนยันแล้ว", () => expect(lastTypes("ordered", 1)).toEqual(["order_summary"]));
  it("text = พิมพ์มา ตอบเป็นข้อความ", () => expect(lastTypes("text", 2)).toEqual(["ai_text", "offers"]));
  it("novoice = Mobile-NoVoice", () =>
    expect(lastTypes("novoice", 3)).toEqual(["system:voice_unavailable", "ai_text", "offers"]));
  it("guard = Mobile-Guard (ต่อราคาแล้ว → หลอก + ถามต้นทุน)", () => {
    expect(lastTypes("guard", 5)).toEqual([
      "buyer_text",
      "ai_text",
      "system:price_locked",
      "buyer_text",
      "ai_text",
    ]);
    // ปุ่ม "ดูข้อเสนอ 3 ทางอีกครั้ง" ต้องมีข้อเสนอให้กลับไปดูจริง
    expect(buildScenario("guard", ctx).messages.some((m) => m.type === "offers")).toBe(true);
  });
  it("escalate = Mobile-Escalate", () => {
    const state = buildScenario("escalate", ctx);
    expect(state.mode).toBe("human");
    expect(lastTypes("escalate", 1)).toEqual(["handoff"]);
  });

  it("เวลาเริ่ม 21:30 แล้วเดินทีละนาที", () => {
    const at = buildScenario("ordered", ctx).messages.map((m) => m.at);
    expect(at[0]).toBe("2026-10-23T14:30:00.000Z");
    expect(new Date(at.at(-1)!).getTime() - new Date(at[0]).getTime()).toBeGreaterThan(0);
  });
});
