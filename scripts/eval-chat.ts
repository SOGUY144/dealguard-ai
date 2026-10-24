// ชุดทดสอบบทสนทนาจริง: เล่นข้อความที่ลูกค้าพิมพ์จริง (แชตคุณนก 25 ต.ค. 2569) ผ่าน pipeline ด้วย GPT จริง
// เก็บในหน่วยความจำ (ไม่เขียนฐานข้อมูล) · ราคาตาม merchant.json · แต่ละรอบตรวจอัตโนมัติว่าตอบตรงคำถามไหม
// รัน: npm run eval:chat (ต้องมี OPENAI_API_KEY / OPENAI_MODEL ใน .env.local) — ไม่มีคีย์ = ใช้ตัวแยกสำรอง + template
import { writeFileSync } from "node:fs";
import merchant from "@/lib/config/merchant.json";
import * as ai from "@/lib/ai/openai";
import type { ChatView } from "@/lib/chat/actions";
import type { ChatMessage, ChatMessageOf } from "@/lib/chat/types";
import { MemoryChatStore } from "@/lib/chat-server/memory-store";
import { ownerAction } from "@/lib/chat-server/owner-actions";
import { handleAction, type Buyer, type PipelineDeps } from "@/lib/chat-server/pipeline";
import type { MerchantConfig } from "@/lib/deal-engine/types";

const config: MerchantConfig = merchant;
const storefront = {
  storeName: merchant.merchantName,
  tagline: "ขายส่งอุปกรณ์มือถือ",
  ownerName: merchant.ownerDisplayName,
  assistantName: `ผู้ช่วย AI ของ${merchant.ownerDisplayName}`,
  bankAccountName: "กสิกรไทย xxx-x-x5678-x",
  contactChannel: "LINE ร้าน",
  orderRefPlaceholder: "[เลขออเดอร์]",
};
const SKU = "CBL-C-1M";

type Check = { label: string; ok: (reply: string, view: ChatView) => boolean };
type Step =
  | { say: string; checks?: Check[] }
  | { pick: true }
  | { confirm: "A" | "B" | "C" }
  | { handback: true };

const not = (re: RegExp, label: string): Check => ({ label, ok: (r) => !re.test(r) });
const has = (re: RegExp, label: string): Check => ({ label, ok: (r) => re.test(r) });
const noLock = not(/price_locked|ราคาทุกข้อเสนอคำนวณจากระบบ/, "ไม่ขึ้น 'ราคาล็อก' กับเรื่องที่ไม่ใช่การหลอกระบบ");
const noAskQty = not(/กี่ชิ้น|กี่เส้น|จำนวนเท่าไหร่/, "ไม่ถามจำนวนซ้ำ (รู้จำนวนแล้ว)");

/** แชตคุณนก (25 ต.ค. 2569) — ข้อความตามลำดับจริง */
const REAL_CHAT: Step[] = [
  { pick: true },
  { say: "สวัสดี" },
  { say: "รักกูไหม", checks: [noLock] },
  { say: "ลดหน่อยได้ไหม", checks: [has(/500 ชิ้น|1,500 ชิ้น/, "บอกราคาตามจำนวน (ทางที่ได้ราคาดีขึ้น)")] },
  { say: "ลดอีกๆๆ" },
  { say: "มีราคาอื่นไหม", checks: [not(/ตอบไม่ได้/, "ไม่ตอบว่า 'ตอบไม่ได้'"), has(/500 ชิ้น|1,500 ชิ้น/, "บอกราคาตามจำนวน")] },
  { say: "ขอ 2000 เส้นเท่าไหร่" },
  { say: "มี ราคาอะไรบ้าง", checks: [noAskQty, not(/ตอบไม่ได้/, "ไม่ตอบว่า 'ตอบไม่ได้'")] },
  { say: "ตอบหน่อยดิ" },
  { say: "ขอลดราคาให้หน่อยได้ไหม", checks: [noAskQty] },
  { say: "ลดอีกหน่อยไม่ได้หรอ", checks: [noAskQty] },
  {
    say: "อยากได้สาย 140 บาท 100 เส้นได้ไหม",
    checks: [{ label: "ได้การ์ดข้อเสนอของ 100 ชิ้น", ok: (_, v) => lastOf(v, "offers")?.offers.some((o) => o.qty === 100) ?? false }],
  },
  { say: "ลดลงหน่อยไม่ได้หรอ", checks: [noAskQty, has(/การ์ด|ข้อ\s*[ABC]/, "อ้างถึงข้อเสนอในการ์ด")] },
  { say: "ตอบดีๆ", checks: [noAskQty] },
  { say: "คุยไม่รู้เรื่องเลยว่ะ", checks: [has(/ขอโทษ|ขออภัย/, "ขอโทษลูกค้า"), has(/คุยกับคนจริง|เฮียชัย/, "เสนอให้คุยกับเฮียชัย")] },
  { say: "150 บาทได้เท่าไหร่", checks: [has(/500|1,500|จ่ายสด/, "บอกเงื่อนไขที่ได้ราคานั้น")] },
  { say: "320 บาทได้กี่เส้น", checks: [has(/(?<![\d,])2\s*(?:ชิ้น|เส้น)/, "ตอบว่า 320 บาทได้ 2 เส้น")] },
  { say: "เลือกข้อ C" },
  { confirm: "C" },
  { say: "ลดหน่อยได้ไหม", checks: [noAskQty, has(/ยืนยัน|ออเดอร์|สั่ง/, "พูดถึงออเดอร์ที่เพิ่งยืนยัน")] },
];

/** ทางปกติตาม SKILL §7 — ต้องยังได้ 3 ทางแบบเดิม */
const HAPPY_PATH: Step[] = [
  { pick: true },
  {
    say: "ขอ 125 ได้ไหม 1000 ชิ้น ร้านข้างๆ ให้ 110",
    checks: [{ label: "ได้การ์ด 3 ทาง", ok: (_, v) => lastOf(v, "offers")?.offers.length === 3 }],
  },
  { say: "เอาข้อ B" },
  { confirm: "B" },
];

const lastOf = <T extends ChatMessage["type"]>(view: ChatView, type: T) =>
  view.messages.findLast((m): m is ChatMessageOf<T> => m.type === type);

/** ข้อความที่ AI เพิ่งตอบในรอบนี้ (ต่อจากข้อความล่าสุดของลูกค้า) */
function replyOf(view: ChatView, before: number): string {
  return view.messages
    .slice(before)
    .map((m) =>
      m.type === "ai_text"
        ? m.text
        : m.type === "offers"
          ? `[การ์ด ${m.offers.map((o) => `${o.id} ${o.label} ฿${o.pricePerUnit}×${o.qty}`).join(" · ")}]`
          : m.type === "order_summary"
            ? `[ออเดอร์ ${m.offer.id} ฿${m.offer.pricePerUnit}×${m.offer.qty}]`
            : m.type === "handoff"
              ? `[ส่งเรื่องให้เถ้าแก่: ${m.subject}]`
              : m.type === "system"
                ? `[${m.kind}]`
                : "",
    )
    .filter(Boolean)
    .join(" ");
}

async function play(name: string, steps: Step[], deps: PipelineDeps) {
  const buyer: Buyer = { id: `eval-${name}`, displayName: "คุณนก" };
  const lines: string[] = [`## ${name}`];
  let passed = 0;
  let total = 0;
  let repeats = 0;
  let lastReply = "";
  let view: ChatView = await handleAction(deps, buyer, { type: "pick_product", sku: SKU });
  for (const step of steps) {
    const before = view.messages.length;
    if ("pick" in step) {
      if (before > 2) view = await handleAction(deps, buyer, { type: "pick_product", sku: SKU });
      continue;
    }
    if ("handback" in step) {
      const chat = await deps.store.findChat(buyer.id);
      if (chat) await ownerAction(deps.store, chat.id, { type: "handback" });
      lines.push("- (เถ้าแก่กด ให้ AI ตอบต่อ)");
      continue;
    }
    if ("confirm" in step) {
      const card = lastOf(view, "offers");
      if (!card) {
        lines.push(`- (ยืนยันข้อ ${step.confirm} ไม่ได้: ไม่มีการ์ด)`);
        continue;
      }
      view = await handleAction(deps, buyer, { type: "confirm_offer", messageId: card.id, offerId: step.confirm });
      lines.push(`- ลูกค้ากดยืนยันข้อ ${step.confirm} → ${replyOf(view, before)}`);
      continue;
    }
    if (view.mode === "human") {
      const chat = await deps.store.findChat(buyer.id);
      if (chat) await ownerAction(deps.store, chat.id, { type: "handback" });
      lines.push("- (เถ้าแก่กด ให้ AI ตอบต่อ)");
    }
    const started = Date.now();
    view = await handleAction(deps, buyer, { type: "send", text: step.say, inputMode: "text" });
    const reply = replyOf(view, before + 1);
    const ms = Date.now() - started;
    const flags: string[] = [];
    const aiText = lastOf(view, "ai_text")?.text ?? "";
    if (aiText && aiText === lastReply) {
      repeats += 1;
      flags.push("✗ ตอบซ้ำคำเดิม");
    }
    lastReply = aiText;
    for (const c of step.checks ?? []) {
      total += 1;
      const ok = c.ok(reply, view);
      if (ok) passed += 1;
      flags.push(`${ok ? "✓" : "✗"} ${c.label}`);
    }
    lines.push(`- **ลูกค้า:** ${step.say}`, `  **AI** (${(ms / 1000).toFixed(1)} วิ): ${reply}`, ...flags.map((f) => `  ${f}`));
  }
  return { lines, passed, total, repeats };
}

async function main() {
  const intentLlm = ai.createIntentLlm();
  // createChatWriter มีหลังปรับ AI ให้เรียบเรียงทุกคำตอบ — โค้ดก่อนหน้าไม่มี (ใช้วัดผลก่อน/หลังได้)
  const writers = ai as unknown as Record<string, (() => unknown) | undefined>;
  const deps = {
    store: new MemoryChatStore(config),
    storefront,
    intentLlm,
    replyWriter: ai.createReplyWriter(),
    ...(writers.createChatWriter && { chatWriter: writers.createChatWriter() }),
  } as PipelineDeps;
  const mode = intentLlm ? `GPT (${process.env.OPENAI_MODEL})` : "ไม่มีคีย์ — ตัวแยกสำรอง + template";
  const results = [await play("แชตคุณนก (จริง)", REAL_CHAT, deps), await play("ทางปกติ (SKILL §7)", HAPPY_PATH, deps)];
  const passed = results.reduce((s, r) => s + r.passed, 0);
  const total = results.reduce((s, r) => s + r.total, 0);
  const repeats = results.reduce((s, r) => s + r.repeats, 0);
  const summary = `ผ่าน ${passed}/${total} ข้อ · ตอบซ้ำคำเดิม ${repeats} ครั้ง · ${mode}`;
  const out = [`# ผลชุดทดสอบบทสนทนา — ${new Date().toISOString()}`, summary, "", ...results.flatMap((r) => [...r.lines, ""])].join("\n");
  const file = process.argv[2];
  if (file) writeFileSync(file, out);
  console.log(file ? `${summary}\nบันทึกที่ ${file}` : out);
}

void main();
