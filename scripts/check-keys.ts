// เช็กคีย์ก่อนเริ่มเขียนแอป: GPT ตอบได้ไหม และ ElevenLabs อ่านภาษาไทยด้วยเสียงเถ้าแก่ได้ไหม
// รัน: npm run check-keys   (อ่านค่าจาก .env.local — สคริปต์ไม่พิมพ์ค่าคีย์ออกมา)
import { mkdir, writeFile } from "node:fs/promises";
import OpenAI from "openai";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";

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
  const lack = missing(["ELEVENLABS_API_KEY", "ELEVENLABS_VOICE_ID"]);
  if (lack.length) {
    console.log(`[เสียง] ข้าม — ยังไม่ได้ตั้ง ${lack.join(", ")}`);
    return false;
  }
  const client = new ElevenLabsClient({ apiKey: process.env.ELEVENLABS_API_KEY });

  const models = await client.models.list();
  const thai = models.filter(
    (m) => m.canDoTextToSpeech && m.languages?.some((l) => l.languageId === "th"),
  );
  console.log(
    `[เสียง] โมเดลที่อ่านภาษาไทยได้: ${thai.map((m) => m.modelId).join(", ") || "ไม่พบ"}`,
  );

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

async function main() {
  let ok = true;
  for (const check of [checkOpenAI, checkElevenLabs]) {
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
