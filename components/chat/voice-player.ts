"use client";

// ตัวเล่นเสียงตอบของ AI ที่ใช้ร่วมกันทั้งหน้า
// iPhone (Safari) ให้หน้าเว็บเล่นเสียงเองได้เฉพาะ <audio> ที่เคยถูกสั่งเล่นจากการแตะของผู้ใช้
// เสียงตอบมาถึงหลังกดไมค์หลายวินาที → ปลดล็อกตัวเล่นนี้ตอนกดไมค์ แล้วใช้ตัวเดียวกันเล่นคำตอบ

/** WAV เงียบสั้นที่สุด — ใช้ปลดล็อกการเล่นเสียง */
const SILENT = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";

let player: HTMLAudioElement | null = null;
let unlocked = false;
/** เสียงที่เล่นเองไปแล้ว — กลับมาหน้าแชตอีกครั้งไม่เล่นซ้ำ */
const autoPlayed = new Set<string>();

export function voicePlayer(): HTMLAudioElement | null {
  if (typeof Audio === "undefined") return null;
  player ??= new Audio();
  return player;
}

/** เรียกจากการแตะของผู้ใช้เท่านั้น (เช่น กดไมค์) */
export function unlockVoicePlayback(): void {
  const p = voicePlayer();
  if (!p || unlocked) return;
  unlocked = true;
  try {
    p.src = SILENT;
    const started = p.play();
    if (started && typeof started.then === "function") void started.then(() => p.pause()).catch(() => {});
  } catch {
    // browser เก่าเล่นไม่ได้ — ลูกค้ากดเล่นเองได้
  }
}

/** true = ยังไม่เคยเล่นเองมาก่อน (และจดไว้ว่าเล่นแล้ว) */
export function claimAutoPlay(url: string): boolean {
  if (autoPlayed.has(url)) return false;
  autoPlayed.add(url);
  return true;
}
