import { describe, expect, it } from "vitest";
import { groupMessages } from "../group";
import type { ChatMessage } from "../types";

const at = "2026-10-23T14:30:00Z";
const ai = (id: string, text = "hi"): ChatMessage => ({ id, at, type: "ai_text", text });
const buyer = (id: string): ChatMessage => ({ id, at, type: "buyer_text", text: "ขอ 125", inputMode: "text" });

describe("groupMessages", () => {
  it("ข้อความฝั่ง AI ที่ติดกันอยู่ใต้ avatar เดียว", () => {
    const rows = groupMessages([ai("1"), ai("2"), buyer("3"), ai("4")]);
    expect(rows.map((r) => [r.kind, r.messages.map((m) => m.id)])).toEqual([
      ["ai", ["1", "2"]],
      ["buyer", ["3"]],
      ["ai", ["4"]],
    ]);
  });

  it("ข้อความลูกค้าแต่ละข้อความแยกแถว", () => {
    const card: ChatMessage = { id: "p", at, type: "product_card", sku: "X", name: "X", listPrice: 1 };
    const rows = groupMessages([buyer("1"), card]);
    expect(rows.map((r) => r.kind)).toEqual(["buyer", "buyer"]);
  });

  it("chip ราคาล็อกอยู่กลางจอ แยกจากกลุ่ม AI", () => {
    const locked: ChatMessage = { id: "s", at, type: "system", kind: "price_locked" };
    const rows = groupMessages([ai("1"), locked, ai("2")]);
    expect(rows.map((r) => r.kind)).toEqual(["ai", "notice", "ai"]);
  });

  it("chip เสียงยังไม่พร้อม อยู่ในกลุ่ม AI เดียวกับคำตอบ", () => {
    const noVoice: ChatMessage = { id: "s", at, type: "system", kind: "voice_unavailable" };
    const rows = groupMessages([buyer("1"), noVoice, ai("2")]);
    expect(rows.map((r) => [r.kind, r.messages.map((m) => m.id)])).toEqual([
      ["buyer", ["1"]],
      ["ai", ["s", "2"]],
    ]);
  });
});
