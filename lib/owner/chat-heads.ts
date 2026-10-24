// หัวแชตลอยแบบ Messenger บนจอเถ้าแก่ทุกหน้า: ลูกค้าทักมา → วงกลมเด้งขึ้นมุมจอ กดแล้วเข้าแชตเลย
// ไฟล์นี้ไม่แตะฐานข้อมูล (ใช้ได้ทั้ง server และ browser) — ตัวอ่านข้อมูลอยู่ใน chat-heads-read.ts
import type { ChatMessage } from "@/lib/chat/types";

/** แชตหนึ่งห้องเท่าที่หัวแชตต้องรู้ */
export type ChatHeadSource = {
  chatId: string;
  buyerName: string;
  /** AI หยุดตอบ รอเถ้าแก่ */
  needsOwner: boolean;
  /** ข้อความล่าสุดของลูกค้า — id เปลี่ยน = ลูกค้าทักมาใหม่ */
  lastBuyer: { id: string; text: string } | null;
  /** หัวข้อที่ส่งเรื่องมาล่าสุด เช่น "ขอคืนเงิน" (เฉพาะตอนรอเถ้าแก่) */
  subject: string | null;
};

export function toChatHeadSource(
  chatId: string,
  buyerName: string,
  mode: "ai" | "human",
  messages: ChatMessage[],
): ChatHeadSource {
  const buyer = messages.findLast((m) => m.type === "buyer_text");
  const handoff = messages.findLast((m) => m.type === "handoff");
  return {
    chatId,
    buyerName,
    needsOwner: mode === "human",
    lastBuyer: buyer?.type === "buyer_text" ? { id: buyer.id, text: buyer.text } : null,
    subject: mode === "human" && handoff?.type === "handoff" ? handoff.subject : null,
  };
}

export type ChatHead = {
  chatId: string;
  buyerName: string;
  needsOwner: boolean;
  subject: string | null;
  /** ข้อความใหม่ที่ยังไม่ได้เปิดดู */
  unread: number;
  preview: string;
  /** โชว์กล่องข้อความข้างวงกลม (ข้อความเพิ่งเข้ามา) */
  peek: boolean;
};

export type HeadsState = {
  heads: ChatHead[];
  /** id ข้อความล่าสุดของลูกค้าที่เห็นแล้วในแต่ละแชต · null = ยังไม่เคยดึง */
  seen: Record<string, string | null> | null;
  /** แชตรอเถ้าแก่ที่เคยเด้งแล้ว — เปิดดู/ปิดไปแล้วไม่เด้งซ้ำ จนกว่าลูกค้าจะทักใหม่หรือมีเรื่องใหม่ */
  shownWaiting: string[];
};

export const EMPTY_HEADS: HeadsState = { heads: [], seen: null, shownWaiting: [] };

/** เก็บหัวแชตไว้มากสุดเท่านี้ (ที่เกินแสดงเป็น +N) */
export const MAX_HEADS = 8;

const previewOf = (s: ChatHeadSource) => s.lastBuyer?.text ?? (s.subject ? `ส่งเรื่องมา · ${s.subject}` : "ทักมา");

/**
 * รวมข้อมูลล่าสุดเข้ากับหัวแชตที่มีอยู่ (sources เรียงล่าสุดก่อน)
 * - ดึงครั้งแรก: จำข้อความที่มีอยู่แล้ว ไม่เด้งของเก่า ยกเว้นแชตที่รอเถ้าแก่อยู่ (ขึ้นเงียบๆ ไม่โชว์กล่องข้อความ)
 * - ลูกค้าทักใหม่ → ขึ้นบนสุด นับข้อความใหม่ โชว์กล่องข้อความ
 * - แชตที่เปิดดูอยู่ (openChatId) → ไม่มีหัวแชต ถือว่าอ่านแล้ว
 */
export function mergeHeads(state: HeadsState, sources: ChatHeadSource[], openChatId: string | null): HeadsState {
  const first = state.seen === null;
  const seen: Record<string, string | null> = { ...state.seen };
  let heads = state.heads.filter((h) => h.chatId !== openChatId);
  let shownWaiting = state.shownWaiting.filter((id) => sources.some((s) => s.chatId === id && s.needsOwner));
  const fresh: ChatHead[] = [];

  for (const s of sources) {
    const lastId = s.lastBuyer?.id ?? null;
    const isNew = !first && lastId !== null && seen[s.chatId] !== lastId;
    seen[s.chatId] = lastId;
    if (s.chatId === openChatId) {
      if (s.needsOwner && !shownWaiting.includes(s.chatId)) shownWaiting = [...shownWaiting, s.chatId];
      continue;
    }

    const existing = heads.find((h) => h.chatId === s.chatId);
    const waitingAgain = s.needsOwner && !shownWaiting.includes(s.chatId);
    if (s.needsOwner) shownWaiting = shownWaiting.includes(s.chatId) ? shownWaiting : [...shownWaiting, s.chatId];

    if (isNew || (waitingAgain && !existing)) {
      heads = heads.filter((h) => h.chatId !== s.chatId);
      fresh.push({
        chatId: s.chatId,
        buyerName: s.buyerName,
        needsOwner: s.needsOwner,
        subject: s.subject,
        unread: (existing?.unread ?? 0) + (isNew ? 1 : 0),
        preview: previewOf(s),
        // เปิดหน้าครั้งแรก: แชตที่รออยู่ขึ้นเงียบๆ
        peek: !first,
      });
    } else if (existing) {
      // สถานะเปลี่ยน (เถ้าแก่ให้ AI ตอบต่อ / ส่งเรื่องใหม่) โดยลูกค้ายังไม่ทักเพิ่ม
      heads = heads.map((h) => (h.chatId === s.chatId ? { ...h, needsOwner: s.needsOwner, subject: s.subject } : h));
    }
  }

  return { heads: [...fresh, ...heads].slice(0, MAX_HEADS), seen, shownWaiting };
}

/** กล่องข้อความข้างวงกลมหายไปเอง */
export function quietHead(state: HeadsState, chatId: string): HeadsState {
  return { ...state, heads: state.heads.map((h) => (h.chatId === chatId ? { ...h, peek: false } : h)) };
}

/** กดเข้าแชต / กดปิด → หัวแชตหายไป (ลูกค้าทักใหม่ก็เด้งกลับมา) */
export function dropHead(state: HeadsState, chatId: string): HeadsState {
  return { ...state, heads: state.heads.filter((h) => h.chatId !== chatId) };
}

/** อักษรในวงกลม: "คุณแอน" → "แอ" · "SOGUY" → "SO" · "guy" → "GU" */
export function headInitials(name: string): string {
  const clean = name.trim().replace(/^คุณ\s*/, "") || name.trim() || "ลูกค้า";
  const letters = [...new Intl.Segmenter("th", { granularity: "grapheme" }).segment(clean)]
    .map((g) => g.segment)
    .filter((g) => g.trim() !== "");
  return letters.slice(0, 2).join("").toUpperCase();
}

/** สีของแต่ละคน (คนเดิมได้สีเดิมทุกครั้ง) */
export function headTone(chatId: string, tones: number): number {
  let hash = 0;
  for (const ch of chatId) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return hash % tones;
}
