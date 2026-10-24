// Layer 3 ด้วย LLM (เฟส 5): เรียบเรียงข้อความที่มากับการ์ดข้อเสนอให้เป็นธรรมชาติ
// LLM ได้แค่ตัวเลขที่ Deal Engine คิดแล้ว (ไม่ได้ข้อความดิบของลูกค้า) · ตอบเป็นส่วนๆ แล้วตรวจทีละข้อ · ไม่ผ่าน/ช้า/ล่ม → template
import { assembleReply, validateDraft, type ReplyDraft, type ReplyFacts } from "./validator";

export type ReplyWriter = { write(facts: ReplyFacts): Promise<ReplyDraft> };

/** SKILL §6.7: LLM เขียน ≤ 3 วินาที */
const DEFAULT_TIMEOUT_MS = 3000;

export type WrittenText = { text: string; source: "llm" | "template"; reason?: string };

export async function writeOffersText(
  writer: ReplyWriter | null,
  facts: ReplyFacts,
  template: string,
  { timeoutMs = DEFAULT_TIMEOUT_MS }: { timeoutMs?: number } = {},
): Promise<WrittenText> {
  if (!writer) return { text: template, source: "template" };

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<"timeout">((resolve) => {
    timer = setTimeout(() => resolve("timeout"), timeoutMs);
  });
  let draft: ReplyDraft | "timeout";
  try {
    draft = await Promise.race([writer.write(facts), timeout]);
  } catch {
    return { text: template, source: "template", reason: "error" };
  } finally {
    clearTimeout(timer);
  }
  if (draft === "timeout") return { text: template, source: "template", reason: "timeout" };

  const check = validateDraft(draft, facts);
  return check.ok ? { text: assembleReply(draft), source: "llm" } : { text: template, source: "template", reason: check.reason };
}
