import { describe, expect, it } from "vitest";
import type { ChatMessage } from "@/lib/chat/types";
import {
  dropHead,
  EMPTY_HEADS,
  headInitials,
  MAX_HEADS,
  mergeHeads,
  quietHead,
  toChatHeadSource,
  type ChatHeadSource,
} from "../chat-heads";

const src = (chatId: string, lastId: string | null, extra: Partial<ChatHeadSource> = {}): ChatHeadSource => ({
  chatId,
  buyerName: `คุณ${chatId}`,
  needsOwner: false,
  lastBuyer: lastId ? { id: lastId, text: `ข้อความ ${lastId}` } : null,
  subject: null,
  ...extra,
});

describe("mergeHeads — อะไรเด้งเป็นหัวแชต", () => {
  it("เปิดหน้าครั้งแรก: ไม่เด้งข้อความเก่า · แชตที่รอเถ้าแก่ขึ้นเงียบๆ (ไม่มีกล่องข้อความ)", () => {
    const s = mergeHeads(EMPTY_HEADS, [src("a", "m1"), src("b", "m2", { needsOwner: true, subject: "ขอคืนเงิน" })], null);
    expect(s.heads).toEqual([
      expect.objectContaining({ chatId: "b", needsOwner: true, unread: 0, peek: false, preview: "ข้อความ m2", subject: "ขอคืนเงิน" }),
    ]);
  });

  it("ลูกค้าทักใหม่ → ขึ้นบนสุด นับข้อความใหม่ โชว์กล่องข้อความ · ทักซ้ำ = นับเพิ่ม", () => {
    let s = mergeHeads(EMPTY_HEADS, [src("a", "m1"), src("b", "m2")], null);
    s = mergeHeads(s, [src("a", "m3"), src("b", "m2")], null);
    expect(s.heads).toEqual([expect.objectContaining({ chatId: "a", unread: 1, peek: true, preview: "ข้อความ m3" })]);
    s = mergeHeads(s, [src("b", "m4"), src("a", "m5")], null);
    expect(s.heads.map((h) => [h.chatId, h.unread])).toEqual([
      ["b", 1],
      ["a", 2],
    ]);
  });

  it("ข้อมูลเดิมดึงซ้ำ (เช่น AI ตอบ) → ไม่เด้งเพิ่ม", () => {
    let s = mergeHeads(EMPTY_HEADS, [src("a", "m1")], null);
    s = mergeHeads(s, [src("a", "m2")], null);
    const again = mergeHeads(s, [src("a", "m2")], null);
    expect(again.heads).toEqual(s.heads);
  });

  it("ลูกค้าใหม่ที่เพิ่งเริ่มคุยหลังเปิดหน้า → เด้ง", () => {
    let s = mergeHeads(EMPTY_HEADS, [src("a", "m1")], null);
    s = mergeHeads(s, [src("new", "m9"), src("a", "m1")], null);
    expect(s.heads.map((h) => h.chatId)).toEqual(["new"]);
  });

  it("แชตที่เปิดดูอยู่ → ไม่มีหัวแชต และข้อความนั้นถือว่าอ่านแล้ว (ออกจากหน้าแชตไม่เด้งกลับ)", () => {
    let s = mergeHeads(EMPTY_HEADS, [src("a", "m1")], null);
    s = mergeHeads(s, [src("a", "m2")], null);
    s = mergeHeads(s, [src("a", "m2")], "a");
    expect(s.heads).toEqual([]);
    s = mergeHeads(s, [src("a", "m2")], null);
    expect(s.heads).toEqual([]);
  });

  it("กดปิดแชตที่รอเถ้าแก่ → ไม่เด้งซ้ำ · ลูกค้าทักใหม่ → เด้งกลับมา", () => {
    let s = mergeHeads(EMPTY_HEADS, [src("b", "m1", { needsOwner: true })], null);
    s = dropHead(s, "b");
    s = mergeHeads(s, [src("b", "m1", { needsOwner: true })], null);
    expect(s.heads).toEqual([]);
    s = mergeHeads(s, [src("b", "m2", { needsOwner: true })], null);
    expect(s.heads).toEqual([expect.objectContaining({ chatId: "b", unread: 1, peek: true })]);
  });

  it("กลับเป็น AI ตอบแล้วส่งเรื่องมาใหม่ → เด้งอีกครั้ง", () => {
    let s = mergeHeads(EMPTY_HEADS, [src("b", "m1", { needsOwner: true })], null);
    s = dropHead(s, "b");
    s = mergeHeads(s, [src("b", "m1")], null);
    s = mergeHeads(s, [src("b", "m1", { needsOwner: true, subject: "ร้องเรียน" })], null);
    expect(s.heads).toEqual([expect.objectContaining({ chatId: "b", needsOwner: true, subject: "ร้องเรียน", peek: true })]);
  });

  it(`เก็บไว้มากสุด ${MAX_HEADS} คน (ใหม่สุดก่อน)`, () => {
    let s = mergeHeads(EMPTY_HEADS, [], null);
    const many = Array.from({ length: MAX_HEADS + 3 }, (_, i) => src(`c${i}`, `m${i}`));
    s = mergeHeads(s, many, null);
    expect(s.heads).toHaveLength(MAX_HEADS);
    expect(s.heads[0].chatId).toBe("c0");
  });

  it("quietHead ปิดกล่องข้อความ (วงกลมยังอยู่)", () => {
    let s = mergeHeads(EMPTY_HEADS, [], null);
    s = quietHead(mergeHeads(s, [src("a", "m1")], null), "a");
    expect(s.heads).toEqual([expect.objectContaining({ chatId: "a", peek: false, unread: 1 })]);
  });
});

describe("toChatHeadSource / headInitials", () => {
  it("ใช้ข้อความลูกค้าล่าสุด · หัวข้อส่งเรื่องเฉพาะตอนรอเถ้าแก่", () => {
    const messages = [
      { id: "1", at: "2026-10-25T01:00:00Z", type: "buyer_text", text: "ขอ 125 ได้ไหม" },
      { id: "2", at: "2026-10-25T01:01:00Z", type: "handoff", subject: "ขอราคาพิเศษ" },
      { id: "3", at: "2026-10-25T01:02:00Z", type: "buyer_text", text: "รอนะครับ" },
    ] as ChatMessage[];
    expect(toChatHeadSource("c", "คุณแอน", "human", messages)).toEqual({
      chatId: "c",
      buyerName: "คุณแอน",
      needsOwner: true,
      lastBuyer: { id: "3", text: "รอนะครับ" },
      subject: "ขอราคาพิเศษ",
    });
    expect(toChatHeadSource("c", "คุณแอน", "ai", messages).subject).toBeNull();
  });

  it.each([
    ["คุณแอน", "แอ"],
    ["คุณนก", "นก"],
    ["SOGUY", "SO"],
    ["guy", "GU"],
    ["ลูกค้าทดสอบ", "ลูก"],
    ["  ", "ลูก"],
  ])("%j → %j", (name, initials) => {
    expect(headInitials(name)).toBe(initials);
  });
});
