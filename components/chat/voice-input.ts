"use client";

import { UnauthorizedError } from "@/lib/chat/transport";

/** อัดเสียงหนึ่งครั้ง — start ขอสิทธิ์ไมค์ (อาจโดนปฏิเสธ) · stop คืนไฟล์เสียง */
export type Recorder = { start: () => Promise<void>; stop: () => Promise<Blob> };

/** Chrome/Android = webm, Safari/iOS = mp4 — เลือกแบบที่ browser อัดได้ */
const TYPES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];

export function browserRecorder(): Recorder {
  let recorder: MediaRecorder | null = null;
  let stream: MediaStream | null = null;
  const chunks: Blob[] = [];
  return {
    async start() {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
        throw new DOMException("no mic support", "NotSupportedError");
      }
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = TYPES.find((t) => MediaRecorder.isTypeSupported(t));
      recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      recorder.start();
    },
    stop() {
      return new Promise((resolve) => {
        const done = () => {
          stream?.getTracks().forEach((t) => t.stop());
          resolve(new Blob(chunks, { type: recorder?.mimeType || "audio/webm" }));
        };
        if (!recorder || recorder.state === "inactive") return done();
        recorder.onstop = done;
        recorder.stop();
      });
    },
  };
}

/** ส่งเสียงไปแปลงเป็นข้อความที่ server · "" = ไม่ได้ยินคำพูด */
export async function transcribeAudio(audio: Blob): Promise<string> {
  const form = new FormData();
  const ext = audio.type.includes("mp4") ? "mp4" : audio.type.includes("ogg") ? "ogg" : "webm";
  form.append("audio", audio, `voice.${ext}`);
  const res = await fetch("/api/transcribe", { method: "POST", body: form });
  if (res.status === 401) throw new UnauthorizedError("unauthorized");
  if (res.status === 422) return "";
  if (!res.ok) throw new Error(`transcribe ${res.status}`);
  return ((await res.json()) as { text: string }).text;
}

/** base64 จาก server → URL ที่ <audio> เล่นได้ (อยู่ในเครื่องเท่านั้น) */
export function audioUrlFromBase64(base64: string, mimeType: string): string {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  return URL.createObjectURL(new Blob([bytes], { type: mimeType }));
}
