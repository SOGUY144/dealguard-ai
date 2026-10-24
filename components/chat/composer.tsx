"use client";

import { ArrowRight, LayoutGrid, LoaderCircle, Mic, Square } from "lucide-react";
import { useId, useState, type FormEvent } from "react";
import { buttonClass } from "@/components/ui/button";
import type { Suggestion } from "@/lib/chat/actions";
import { cn } from "@/lib/cn";

export type VoiceState = "idle" | "recording" | "transcribing";

type Props = {
  placeholder: string;
  suggestions: Suggestion[];
  productsOpen: boolean;
  voiceState: VoiceState;
  /** รอคำตอบอยู่ — ส่งเพิ่มไม่ได้ (พิมพ์รอไว้ได้) */
  busy?: boolean;
  /** false = server ไม่มีคีย์แปลงเสียง ปุ่มไมค์กดไม่ได้ */
  micAvailable?: boolean;
  /** ไมค์ใช้ไม่ได้ / แปลงเสียงไม่ได้ — บอกลูกค้าให้พิมพ์แทน */
  voiceNotice?: string | null;
  /** คืน false = ส่งไม่สำเร็จ → คืนข้อความไว้ในช่องพิมพ์ */
  onSend: (text: string) => void | Promise<boolean>;
  onSuggestion: (suggestion: Suggestion) => void;
  onToggleProducts: () => void;
  /** กดครั้งแรก = เริ่มอัด, กดอีกครั้ง = หยุดแล้วส่ง */
  onMicPress: () => void;
};

const VOICE_STATUS: Record<VoiceState, string> = {
  idle: "",
  recording: "กำลังอัดเสียง… กดอีกครั้งเพื่อส่ง",
  transcribing: "กำลังแปลงเสียงเป็นข้อความ…",
};

export function Composer({
  placeholder,
  suggestions,
  productsOpen,
  voiceState,
  busy = false,
  micAvailable = true,
  voiceNotice = null,
  onSend,
  onSuggestion,
  onToggleProducts,
  onMicPress,
}: Props) {
  const [text, setText] = useState("");
  const inputId = useId();

  function submit(e: FormEvent) {
    e.preventDefault();
    const value = text.trim();
    if (!value || busy) return;
    const result = onSend(value);
    setText("");
    if (result instanceof Promise) {
      void result.then((ok) => {
        if (!ok) setText((current) => current || value);
      });
    }
  }

  const recording = voiceState === "recording";

  return (
    <div className="mx-auto flex w-full max-w-[808px] shrink-0 flex-col gap-2 px-3 pt-1.5 pb-4 md:gap-2.5 md:px-6 md:pt-1 md:pb-[18px]">
      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {suggestions.map((s) => (
            <button
              key={s.label}
              type="button"
              onClick={() => onSuggestion(s)}
              disabled={busy && s.action.type === "send"}
              className={buttonClass("chip", "min-h-10 justify-start whitespace-normal md:px-4 md:text-sm")}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}

      <p
        role="status"
        className={cn(
          "px-1 text-xs",
          voiceNotice && voiceState === "idle" ? "text-warn-ink" : "text-accent-ink",
          voiceState === "idle" && !voiceNotice && "sr-only",
        )}
      >
        {voiceState === "idle" ? voiceNotice : VOICE_STATUS[voiceState]}
      </p>

      <form
        onSubmit={submit}
        className="flex flex-col gap-1 rounded-[22px] border-[1.5px] border-accent-border bg-white py-2 pr-2 pl-3.5 shadow-soft md:gap-2 md:pt-3 md:pr-3 md:pb-2.5 md:pl-4"
      >
        <label htmlFor={inputId} className="sr-only">
          พิมพ์ข้อความ
        </label>
        <input
          id={inputId}
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={placeholder}
          autoComplete="off"
          enterKeyHint="send"
          className="h-9 w-full bg-transparent text-sm outline-none placeholder:text-muted md:text-[15px]"
        />
        <div className="flex items-center gap-1 md:gap-1.5">
          <button
            type="button"
            aria-pressed={productsOpen}
            onClick={onToggleProducts}
            className={buttonClass("secondary", "h-10 min-h-0 gap-1.5 px-3 text-[13px] md:gap-2 md:px-3.5 md:text-sm")}
          >
            <LayoutGrid aria-hidden="true" size={16} />
            สินค้า
          </button>
          <button
            type="button"
            aria-label={recording ? "หยุดและส่งเสียง" : micAvailable ? "พูดด้วยเสียง" : "พูดด้วยเสียง (ยังไม่เปิดใช้)"}
            onClick={onMicPress}
            disabled={!micAvailable || voiceState === "transcribing"}
            className={cn(
              buttonClass("ghost", "size-11 p-0 md:size-10"),
              recording && "bg-accent-tint text-accent-ink ring-2 ring-accent-border motion-safe:animate-pulse",
            )}
          >
            {voiceState === "transcribing" ? (
              <LoaderCircle aria-hidden="true" size={19} className="motion-safe:animate-spin" />
            ) : recording ? (
              <Square aria-hidden="true" size={16} fill="currentColor" />
            ) : (
              <Mic aria-hidden="true" size={20} />
            )}
          </button>
          <span className="flex-1" />
          <button
            type="submit"
            aria-label="ส่งข้อความ"
            aria-disabled={busy || undefined}
            className={buttonClass("primary", "size-11 p-0 text-sm md:h-[42px] md:min-h-0 md:w-auto md:px-5")}
          >
            <span aria-hidden="true" className="hidden md:inline">
              ส่ง
            </span>
            <ArrowRight aria-hidden="true" size={17} strokeWidth={2.2} />
          </button>
        </div>
      </form>

      <p className="hidden text-center text-xs text-muted md:block">
        ราคาทุกข้อเสนอคำนวณโดยระบบของร้าน ผู้ช่วย AI เปลี่ยนราคาเองไม่ได้
      </p>
    </div>
  );
}
