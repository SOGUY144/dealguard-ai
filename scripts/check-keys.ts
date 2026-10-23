// เช็กคีย์ก่อนเริ่มเขียนแอป: GPT ตอบได้ไหม, ElevenLabs อ่านภาษาไทยได้ไหม, Supabase ต่อได้ไหม
// รัน: npm run check-keys   (อ่านค่าจาก .env.local — สคริปต์ไม่พิมพ์ค่าคีย์ออกมา)
import { mkdir, writeFile } from "node:fs/promises";
import OpenAI from "openai";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { createClient } from "@supabase/supabase-js";

const OUT_DIR = ".check-keys";
const SAMPLE_TEXT = "สวัสดีครับ ผู้ช่วย AI ของเฮียชัยครับ ราคานี้เฮียให้ไม่ไหว แต่มี 3 ทางให้เลือกครับ";

function missing(names: string[]): string[] {
  return names.filter((n) => !process.env[n]);
}

async function checkOpenAI(): Promise<boolean> {
  const lack = missing(["OPENAI_API_KEY", "OPENAI_MODEL"]);
  if (lack.length) {
    console.log(`[GPT] ข้าม — ยังไม่ได้ตั้ง ${lack.join(", ")}`);
    return false;
  }
  const client = new OpenAI();
  const started = Date.now();
  const res = await client.responses.create({
    model: process.env.OPENAI_MODEL!,
    input: "ตอบกลับคำเดียวว่า พร้อม",
  });
  console.log(`[GPT] ผ่าน · ${Date.now() - started} ms · ตอบว่า "${res.output_text.trim()}"`);
  return true;
}

async function checkElevenLabs(): Promise<boolean> {
  if (missing(["ELEVENLABS_API_KEY"]).length) {
    console.log("[เสียง] ข้าม — ยังไม่ได้ตั้ง ELEVENLABS_API_KEY");
    return false;
  }
  const client = new ElevenLabsClient({ apiKey: process.env.ELEVENLABS_API_KEY });

  // เช็กคีย์ + หาโมเดลไทยได้ก่อน แม้ยังไม่ได้เลือกเสียง
  let models;
  try {
    models = await client.models.list();
  } catch (err) {
    if (String(err).includes("models_read")) {
      console.log(
        "[เสียง] คีย์ใช้ได้ แต่ยังไม่มีสิทธิ์ Models: Read — แก้ที่ ElevenLabs > Developers > API Keys > แก้คีย์ > Models = Read",
      );
      return false;
    }
    throw err;
  }
  const thai = models.filter(
    (m) => m.canDoTextToSpeech && m.languages?.some((l) => l.languageId === "th"),
  );
  console.log(
    `[เสียง] คีย์ใช้ได้ · โมเดลที่อ่านภาษาไทยได้: ${thai.map((m) => m.modelId).join(", ") || "ไม่พบ"}`,
  );

  if (missing(["ELEVENLABS_VOICE_ID"]).length) {
    console.log("[เสียง] ยังไม่ได้ตั้ง ELEVENLABS_VOICE_ID — เลือกเสียงผู้ชายใน Voice Library แล้วใส่ id เพื่อลองอัดเสียง");
    return false;
  }

  const modelId = process.env.ELEVENLABS_MODEL_ID || thai[0]?.modelId;
  if (!modelId) {
    console.log("[เสียง] ไม่ผ่าน — บัญชีนี้ไม่มีโมเดลที่อ่านภาษาไทยได้");
    return false;
  }
  if (!thai.some((m) => m.modelId === modelId)) {
    console.log(`[เสียง] เตือน — ${modelId} ไม่ได้ประกาศว่ารองรับภาษาไทย`);
  }

  const started = Date.now();
  const stream = await client.textToSpeech.convert(process.env.ELEVENLABS_VOICE_ID!, {
    text: SAMPLE_TEXT,
    modelId,
    outputFormat: "mp3_44100_128",
  });
  const audio = Buffer.from(await new Response(stream).arrayBuffer());

  await mkdir(OUT_DIR, { recursive: true });
  const file = `${OUT_DIR}/tts-sample.mp3`;
  await writeFile(file, audio);
  console.log(
    `[เสียง] ผ่าน · ${modelId} · ${Date.now() - started} ms · ${Math.round(audio.length / 1024)} KB → ${file} (เปิดฟังว่าออกเสียงไทยถูกไหม)`,
  );
  return true;
}

async function checkSupabase(): Promise<boolean> {
  const lack = missing(["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"]);
  if (lack.length) {
    console.log(`[Supabase] ข้าม — ยังไม่ได้ตั้ง ${lack.join(", ")}`);
    return false;
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;

  // คีย์ฝั่ง browser: อ่านค่าตั้ง Auth ได้ (บอกด้วยว่าเปิดยืนยันอีเมลอยู่ไหม)
  const res = await fetch(`${url}/auth/v1/settings`, {
    headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! },
  });
  if (!res.ok) {
    console.log(`[Supabase] publishable key ใช้ไม่ได้ (HTTP ${res.status})`);
    return false;
  }
  const settings = (await res.json()) as { mailer_autoconfirm?: boolean; external?: { email?: boolean } };

  // คีย์ฝั่ง server: เรียก admin API ได้
  const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const { error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1 });
  if (error) {
    console.log(`[Supabase] secret key ใช้ไม่ได้: ${error.message}`);
    return false;
  }

  console.log(
    `[Supabase] ผ่าน · สมัครด้วยอีเมล: ${settings.external?.email ? "เปิด" : "ปิด"} · ยืนยันอีเมล: ${settings.mailer_autoconfirm ? "ปิด (สมัครแล้วใช้ได้ทันที)" : "เปิด"}`,
  );
  return true;
}

async function main() {
  let ok = true;
  for (const check of [checkOpenAI, checkElevenLabs, checkSupabase]) {
    try {
      ok = (await check()) && ok;
    } catch (err) {
      ok = false;
      const message = err instanceof Error ? err.message : String(err);
      console.log(`[${check.name}] error: ${message}`);
    }
  }
  process.exitCode = ok ? 0 : 1;
}

main();
