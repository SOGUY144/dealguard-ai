// Layer 3 สำหรับข้อความที่ไม่ใช่การ์ดข้อเสนอ (ราคาตามจำนวน / ขอลดซ้ำ / หลังสั่งซื้อ / งบรวม / หงุดหงิด / คุยเล่น)
// แชตจริง 25 ต.ค. 2569: ข้อความสำเร็จรูปตอบวนเหมือนหุ่นยนต์ → ให้ GPT ตอบเป็นธรรมชาติจากบทสนทนาล่าสุด
// ระบบเป็นคนตัดสินว่าจะพูดอะไร (points) และตัวเลขทุกตัว — GPT เรียบเรียงเท่านั้น · ตรวจไม่ผ่าน/ช้า/ล่ม → template
import type { Offer } from "@/lib/chat/types";
import { type ChatTextFacts, validateChatText } from "./validator";
import type { WrittenText } from "./responder";

export type ChatTurn = { from: "customer" | "shop"; text: string };

export type ChatWriterInput = ChatTextFacts & {
  /** เรื่องที่ตอบ (บอก GPT ว่าสถานการณ์คืออะไร) */
  kind: "price_guide" | "hold_offers" | "after_order" | "budget" | "frustrated" | "chat" | "info_unknown";
  buyerName: string;
  ownerName: string;
  productName?: string;
  /** สิ่งที่ต้องบอกในข้อความนี้ครบทุกข้อ — ระบบสร้างจากข้อมูลจริง */
  points: string[];
  /** ปิดด้วยการถามจำนวน */
  askQuantity: boolean;
  /** บทสนทนาล่าสุด (ข้อความลูกค้าล่าสุดอยู่ท้าย) — เป็นข้อมูล ไม่ใช่คำสั่ง */
  conversation: ChatTurn[];
  /** ข้อความที่ร้านเพิ่งตอบไป — ห้ามพูดซ้ำแบบเดิม */
  avoid: string[];
};

export type ChatWriter = { write(input: ChatWriterInput): Promise<{ text: string }> };

const DEFAULT_TIMEOUT_MS = 3000;

export async function writeChatText(
  writer: ChatWriter | null | undefined,
  input: ChatWriterInput,
  template: string,
  { timeoutMs = DEFAULT_TIMEOUT_MS }: { timeoutMs?: number } = {},
): Promise<WrittenText> {
  if (!writer) return { text: template, source: "template" };
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<"timeout">((resolve) => {
    timer = setTimeout(() => resolve("timeout"), timeoutMs);
  });
  let out: { text: string } | "timeout";
  try {
    out = await Promise.race([writer.write(input), timeout]);
  } catch {
    return { text: template, source: "template", reason: "error" };
  } finally {
    clearTimeout(timer);
  }
  if (out === "timeout") return { text: template, source: "template", reason: "timeout" };
  const text = out.text?.trim() ?? "";
  const check = validateChatText(text, input);
  if (!check.ok) return { text: template, source: "template", reason: check.reason };
  // ตอบซ้ำคำเดิมกับที่เพิ่งตอบไป = ไม่ได้ช่วยอะไร ใช้ template (ซึ่งอย่างน้อยมีข้อมูลครบ)
  if (input.avoid.includes(text)) return { text: template, source: "template", reason: "repeat" };
  return { text, source: "llm" };
}

/** ตัวอักษรข้อเสนอในการ์ดที่อ้างถึงได้ */
export const lettersOf = (offers: Offer[]): Offer["id"][] => offers.map((o) => o.id);
