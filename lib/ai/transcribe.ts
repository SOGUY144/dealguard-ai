// แปลงเสียงลูกค้าเป็นข้อความไทย (เฟส 6) — OpenAI OPENAI_TRANSCRIBE_MODEL
import "server-only";
import OpenAI from "openai";
import { thaiNumberWordsToDigits } from "./thai-numbers";

/** เสียงพูดสั้นๆ 30 วินาทีของ webm/mp4 ราว 0.3–0.5 MB — เผื่อไว้ 3 MB */
export const MAX_AUDIO_BYTES = 3_000_000;
/** Chrome/Android = webm, Safari/iOS = mp4 */
const ALLOWED = /^audio\/(webm|mp4|mpeg|ogg|wav|x-m4a|aac)\b/;

export type AudioCheck = "ok" | "empty" | "too_big" | "bad_type";

export function checkAudio(file: { size: number; type: string }): AudioCheck {
  if (file.size === 0) return "empty";
  if (file.size > MAX_AUDIO_BYTES) return "too_big";
  return ALLOWED.test(file.type) ? "ok" : "bad_type";
}

export type Transcriber = (file: File, productNames: string[]) => Promise<string>;

/** null = ไม่มีคีย์ → ปุ่มไมค์ใช้ไม่ได้ */
export function createTranscriber(): Transcriber | null {
  const model = process.env.OPENAI_TRANSCRIBE_MODEL;
  if (!process.env.OPENAI_API_KEY || !model) return null;
  const client = new OpenAI({ maxRetries: 0 });
  return async (file, productNames) => {
    const result = await client.audio.transcriptions.create(
      {
        file,
        model,
        language: "th",
        // บอกคำที่น่าจะได้ยิน ให้สะกดชื่อสินค้า/คำต่อราคาถูก ("จ่ายสด" เคยได้ยินเป็น "ใจสด")
        prompt: `ลูกค้าร้านขายส่งต่อราคา ${productNames.join(", ")} คำที่ใช้บ่อย: ขอ, ได้ไหม, ชิ้น, บาท, จ่ายสด, โอนทันที, เครดิต, ซื้อเยอะ, ของแถม, ร้านข้างๆ ให้, ขอคืนเงิน, ของเสีย เช่น "ขอ 125 ได้ไหม 1,500 ชิ้น จ่ายสด"`,
      },
      { timeout: 10_000 },
    );
    // ตัวแปลงเสียงชอบเขียนตัวเลขเป็นคำ — แปลงเป็นเลขให้ลูกค้าเห็นชัด และตัวแยกสำรองอ่านได้
    return thaiNumberWordsToDigits(result.text.trim());
  };
}

/** มีคีย์แปลงเสียงไหม (หน้าแชตใช้เปิด/ปิดปุ่มไมค์) */
export function voiceInputAvailable(): boolean {
  return Boolean(process.env.OPENAI_API_KEY && process.env.OPENAI_TRANSCRIBE_MODEL);
}
