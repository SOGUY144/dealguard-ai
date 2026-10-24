// เสียง AI จริงด้วย ElevenLabs (เสียงผู้ชาย "Eric" — ทีมตัดสินใจ ไม่ใช้เสียงเถ้าแก่)
import "server-only";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import type { Speaker } from "./speaker";

/** mp3 64 kbps — ไฟล์เล็ก ส่งเป็น base64 ใน response ได้ (เสียงพูด 10 วินาที ≈ 80 KB) */
const OUTPUT_FORMAT = "mp3_44100_64";
const BITRATE = 64_000;

/** ความยาวเสียงจากขนาดไฟล์ mp3 bitrate คงที่ (ปัด 1 ตำแหน่ง อย่างน้อย 1 วินาที) */
export function mp3DurationSec(bytes: number, bitrate = BITRATE): number {
  return Math.max(1, Math.round(((bytes * 8) / bitrate) * 10) / 10);
}

/** null = ไม่มีคีย์/เสียง/โมเดล → pipeline ตอบเป็นข้อความอย่างเดียว */
export function createSpeaker(): Speaker | null {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const voiceId = process.env.ELEVENLABS_VOICE_ID;
  const modelId = process.env.ELEVENLABS_MODEL_ID;
  if (!apiKey || !voiceId || !modelId) return null;
  const client = new ElevenLabsClient({ apiKey });
  return {
    async speak(text) {
      // ไม่ retry: pipeline ตั้งเวลาไว้แล้ว ช้าเกินก็ตอบเป็นข้อความเลย
      const stream = await client.textToSpeech.convert(
        voiceId,
        { text, modelId, outputFormat: OUTPUT_FORMAT },
        { timeoutInSeconds: 8, maxRetries: 0 },
      );
      const audio = new Uint8Array(await new Response(stream).arrayBuffer());
      return { audio, mimeType: "audio/mpeg", durationSec: mp3DurationSec(audio.byteLength) };
    },
  };
}
