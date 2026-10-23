// อัดประโยคไทยตัวอย่างจากหลายเสียงไว้ฟังเทียบกัน
// รัน: npm run voice-samples -- <voiceId> [<voiceId> ...]
// ไฟล์ออกที่ .check-keys/voice-<ชื่อ>.mp3 (ถูก ignore ใน git)
import { mkdir, writeFile } from "node:fs/promises";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";

const SAMPLE =
  "สวัสดีครับคุณนก ผู้ช่วย AI ของเฮียชัยครับ ราคา 125 ที่ 1,000 ชิ้นเฮียให้ไม่ไหว แต่มี 3 ทางให้เลือกครับ";
const OUT_DIR = ".check-keys";

async function main() {
  const ids = process.argv.slice(2);
  if (!process.env.ELEVENLABS_API_KEY || ids.length === 0) {
    console.log("ใช้: npm run voice-samples -- <voiceId> [<voiceId> ...]  (ต้องมี ELEVENLABS_API_KEY ใน .env.local)");
    process.exitCode = 1;
    return;
  }
  const modelId = process.env.ELEVENLABS_MODEL_ID || "eleven_v4_turbo";
  const client = new ElevenLabsClient({ apiKey: process.env.ELEVENLABS_API_KEY });
  await mkdir(OUT_DIR, { recursive: true });

  for (const id of ids) {
    try {
      const voice = await client.voices.get(id);
      const name = (voice.name ?? id).split(" ")[0].toLowerCase();
      const started = Date.now();
      const stream = await client.textToSpeech.convert(id, { text: SAMPLE, modelId, outputFormat: "mp3_44100_128" });
      const audio = Buffer.from(await new Response(stream).arrayBuffer());
      const file = `${OUT_DIR}/voice-${name}.mp3`;
      await writeFile(file, audio);
      console.log(`${voice.name} · ${modelId} · ${Date.now() - started} ms → ${file}`);
    } catch (err) {
      console.log(`${id}: error ${err instanceof Error ? err.message.split("\n")[0] : err}`);
    }
  }
}

main();
