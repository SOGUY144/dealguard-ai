// ประกอบ pipeline ของจริง: Supabase (service role) + GPT (ถ้ามีคีย์) — สร้างใหม่ทุก request
import "server-only";
import { createIntentLlm } from "@/lib/ai/openai";
import { storefront } from "@/lib/config/storefront";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSpeaker } from "@/lib/voice/elevenlabs";
import type { PipelineDeps } from "./pipeline";
import { SupabaseChatStore } from "./supabase-store";

export function createChatDeps(): PipelineDeps {
  return {
    store: new SupabaseChatStore(createSupabaseAdminClient()),
    storefront,
    intentLlm: createIntentLlm(),
    speaker: createSpeaker(),
  };
}
