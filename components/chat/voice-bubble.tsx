"use client";

import { Pause, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { formatDuration } from "@/lib/format";

// ความสูงของแท่ง waveform จากไฟล์ดีไซน์ (มือถือจะถูกตัดด้วย overflow)
const BARS = [8, 14, 22, 12, 26, 18, 10, 20, 26, 14, 22, 28, 16, 10, 20, 24, 12, 22, 18, 10, 26, 16, 22, 12, 18, 8, 14, 20, 10, 16, 8, 12, 6, 10];

type Props = {
  durationSec: number;
  audioUrl?: string;
  /** เล่นเองทันที (ลูกค้าเพิ่งกดพูด) */
  autoPlay?: boolean;
  /** ไม่มีไฟล์เสียง: true = จำลองการเล่น (ตัวตอบจำลอง) · false = เล่นซ้ำไม่ได้แล้ว (แชตจริงหลังรีโหลด) */
  simulate?: boolean;
};

/**
 * แคปซูลข้อความเสียง (พื้นเข้มจุดเดียวของดีไซน์) — มี audioUrl ก็เล่นเสียงจริง
 * ถ้ายังไม่มี (mock ก่อนเฟส 6) จะจำลองการเล่นตามความยาว
 */
export function VoiceBubble({ durationSec, audioUrl, autoPlay = false, simulate = true }: Props) {
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  // เสียงไม่ได้เก็บในฐานข้อมูล — รีโหลดแล้วเหลือแค่ transcript
  const unavailable = !audioUrl && !simulate;

  useEffect(() => {
    if (!autoPlay || !audioUrl) return;
    const audio = audioRef.current;
    // browser อาจไม่ให้เล่นเอง (ยังไม่ได้แตะหน้าเว็บ) — ลูกค้ากดเล่นเองได้
    if (audio) void tryPlay(audio).then(setPlaying);
  }, [autoPlay, audioUrl]);

  useEffect(() => {
    if (!playing || audioUrl) return;
    const timer = setTimeout(() => setPlaying(false), durationSec * 1000);
    return () => clearTimeout(timer);
  }, [playing, audioUrl, durationSec]);

  function toggle() {
    const audio = audioRef.current;
    if (audio) {
      if (playing) audio.pause();
      else void tryPlay(audio).then((ok) => !ok && setPlaying(false));
    }
    setPlaying(!playing);
  }

  return (
    <div className="bubble-voice flex items-center gap-2.5 py-1.5 pr-1.5 pl-3.5 md:gap-3 md:py-2 md:pr-2 md:pl-4">
      <div aria-hidden="true" className="flex h-[26px] flex-1 items-center gap-[3px] overflow-hidden md:h-7">
        {BARS.map((h, i) => (
          <span
            key={i}
            className={playing ? "w-[3px] shrink-0 rounded-sm bg-white motion-safe:animate-pulse" : "w-[3px] shrink-0 rounded-sm bg-white"}
            style={{ height: h, animationDelay: `${(i % 6) * 120}ms` }}
          />
        ))}
      </div>
      <span className="text-xs text-[var(--on-dark-muted)] md:text-[13px]">{formatDuration(durationSec)}</span>
      <button
        type="button"
        aria-label={unavailable ? "เสียงนี้เล่นซ้ำไม่ได้แล้ว" : playing ? "หยุดข้อความเสียง" : "เล่นข้อความเสียง"}
        onClick={toggle}
        disabled={unavailable}
        className="grid size-11 shrink-0 place-items-center rounded-full bg-white text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
      >
        {playing ? (
          <Pause aria-hidden="true" size={18} fill="currentColor" strokeWidth={0} />
        ) : (
          <Play aria-hidden="true" size={18} fill="currentColor" strokeWidth={0} />
        )}
      </button>
      {audioUrl && <audio ref={audioRef} src={audioUrl} preload="auto" onEnded={() => setPlaying(false)} />}
    </div>
  );
}

/** play() ของ browser เก่า (และ jsdom) อาจไม่คืน Promise — true = เล่นได้ */
async function tryPlay(audio: HTMLAudioElement): Promise<boolean> {
  try {
    await audio.play();
    return true;
  } catch {
    return false;
  }
}

