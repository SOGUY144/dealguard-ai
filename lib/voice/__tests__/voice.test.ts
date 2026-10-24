import { describe, expect, it } from "vitest";
import { checkAudio, MAX_AUDIO_BYTES } from "@/lib/ai/transcribe";
import { mp3DurationSec } from "../elevenlabs";

describe("mp3DurationSec", () => {
  it("64 kbps: 80,000 ไบต์ = 10 วินาที", () => {
    expect(mp3DurationSec(80_000)).toBe(10);
  });
  it("ไฟล์สั้นมาก → อย่างน้อย 1 วินาที", () => {
    expect(mp3DurationSec(100)).toBe(1);
  });
});

describe("checkAudio (ไฟล์เสียงจากไมค์)", () => {
  it("Chrome (webm) / Safari (mp4) ผ่าน", () => {
    expect(checkAudio({ size: 40_000, type: "audio/webm;codecs=opus" })).toBe("ok");
    expect(checkAudio({ size: 40_000, type: "audio/mp4" })).toBe("ok");
  });
  it("ว่าง / ใหญ่เกิน / ไม่ใช่ไฟล์เสียง → ไม่รับ", () => {
    expect(checkAudio({ size: 0, type: "audio/webm" })).toBe("empty");
    expect(checkAudio({ size: MAX_AUDIO_BYTES + 1, type: "audio/webm" })).toBe("too_big");
    expect(checkAudio({ size: 10, type: "text/html" })).toBe("bad_type");
  });
});
