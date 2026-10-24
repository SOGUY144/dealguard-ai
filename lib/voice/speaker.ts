// เสียงตอบของ AI (เฟส 6) — pipeline คุยกับ interface นี้ ของจริงคือ ElevenLabs (lib/voice/elevenlabs.ts)

export type SpokenAudio = { audio: Uint8Array; mimeType: string; durationSec: number };

export interface Speaker {
  speak(text: string): Promise<SpokenAudio>;
}
