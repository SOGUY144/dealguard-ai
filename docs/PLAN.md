# แผนสร้าง DealGuard AI แยกเป็นเฟส

## Context
ติดตั้งสกิลเสร็จแล้ว (superpowers, ui-ux-pro-max, dealguard-ai อยู่ใน `C:\dev\dealguard-ai\.claude\skills`) ไฟล์ดีไซน์อยู่ใน `design/`
ในนั้นมี `HANDOFF.md` (components, routes, data types), `tokens.css`, `tailwind.preset.js` และหน้าจอ 11 ไฟล์ใน `screens/`
ไฟล์ดีไซน์ใช้เป็น reference อย่างเดียว เพราะไม่มี `support.js` ให้รัน

**สิ่งที่ตกลงกับทีมแล้ว**
- Stack: Next.js (App Router) + TypeScript + Tailwind, OpenAI (GPT), ElevenLabs, **Supabase** (Postgres + Auth + Realtime), deploy บน **Vercel**
- **Owner-Chat อยู่ใน MVP:** เถ้าแก่ตอบลูกค้าเองได้ และกด "ให้ AI ตอบต่อ" ได้ (แก้ SKILL §7 แล้ว)
- **ทุกคนต้องมีบัญชี:** ลูกค้าและเถ้าแก่สมัครด้วย**อีเมล + รหัสผ่าน** (Supabase Auth) และ**ต้องล็อกอินก่อนเข้าหน้าเว็บทุกหน้า** ใช้แทน Basic Auth ในแผนเดิม ยังเป็นร้านเดียว ไม่ทำหลายร้าน
- **เสียงเป็นเสียง AI ผู้ชาย** จากคลังเสียงของ ElevenLabs ไม่โคลนเสียงเถ้าแก่ ข้อความยังใช้ "ครับ"
- **ตอบตามแบบที่ลูกค้าใช้:** ลูกค้ากดไมค์พูด → AI ตอบเป็นเสียง + มีข้อความตามมา, ลูกค้าพิมพ์ → AI ตอบเป็นข้อความอย่างเดียว → ไมค์ (STT) ย้ายเข้า MVP
- **Header แชต:** "ผู้ช่วย AI ของเฮียชัย" / "ออนไลน์ · พิมพ์หรือกดไมค์พูดได้" (แทน "ตอบด้วยเสียงเฮียชัย (ได้รับอนุญาต)" ในดีไซน์)
- **shadergradient ทำทีหลัง** ในเฟสขัดเงา และไม่ใช้ liquid-glass-js เพราะ `tokens.css` มีกระจกอยู่แล้ว
- **กฎข้อเสนอ A (ซื้อเยอะ):** เลือก tier ที่เล็กที่สุดซึ่ง `min_qty > จำนวนที่ขอ` และ `price >= floor` ตัวอย่างจะได้ 1,500 × ฿130 ตรงกับดีไซน์

**การตัดสินใจที่ผมเพิ่มเอง**
- **ไม่ทำ Deal Score:** ดีไซน์ไม่แสดง และลำดับ A/B/C ตายตัวตาม lever อยู่แล้ว
- **ปุ่มที่ยังไม่มีเนื้อหา** ได้แก่ "นำเข้าจาก Excel", "วิธีสั่งซื้อ", "ติดต่อร้าน" จะแสดงตามดีไซน์แต่ปิดไว้ (disabled) หรือใส่ placeholder จนถึงเฟส 11 หรือจนกว่าทีมให้ copy
- **หน้าสมัคร / ล็อกอิน / ลืมรหัสผ่าน ไม่มีในดีไซน์** ผมจะทำด้วย tokens และคลาสกระจกเดิม ข้อความในหน้าพวกนี้ต้องให้ทีมตรวจก่อนเดโม

**เรื่องที่ทีมยังต้องตัดสิน (ก่อนเฟส 3)**
- **ยืนยันอีเมลตอนสมัคร:** SMTP ที่ Supabase ให้มาส่งได้น้อยมากต่อชั่วโมงและมีไว้แค่ทดสอบ ถ้าจะเปิดการยืนยันอีเมลบน Vercel ต้องต่อ SMTP ของตัวเอง (เช่น Resend) หรือไม่ก็ปิดการยืนยันไว้ช่วงเดโม
- **นโยบายความเป็นส่วนตัว:** เก็บบัญชีลูกค้าแล้ว ต้องมีหน้านโยบาย (PDPA) และช่องติ๊กยินยอมตอนสมัคร ข้อความนโยบายต้องมาจากทีม

## Tech Stack
| ส่วน | ใช้อะไร | หมายเหตุ |
|---|---|---|
| Framework | **Next.js 16.4** (App Router, Turbopack, Cache Components) + **React 19.3** | API routes อยู่ในโปรเจกต์เดียวกัน ไม่แยก backend · `middleware` ถูกเปลี่ยนชื่อเป็น **`proxy.ts`** |
| ภาษา | **TypeScript** | |
| Styling | **Tailwind CSS v4** + `design/tokens.css` | กระจกใช้คลาส `.glass` / `.btn-primary` จาก tokens |
| ฟอนต์ | **IBM Plex Sans Thai** ผ่าน `next/font/google` | |
| ไอคอน | **lucide-react** | AI = sparkle, ห้ามใช้ emoji |
| LLM (Layer 1 + 3) | **OpenAI GPT** (`openai` SDK, Responses API) + **zod** | structured output → Intent JSON; ชื่อโมเดลตั้งใน `OPENAI_MODEL` |
| เสียงลูกค้า → ข้อความ (STT) | **OpenAI transcription** | ภาษาไทย; ชื่อโมเดลตั้งใน `OPENAI_TRANSCRIBE_MODEL` |
| ข้อความ → เสียง AI (TTS) | **ElevenLabs** (`@elevenlabs/elevenlabs-js`) | เสียงผู้ชายจากคลัง (`ELEVENLABS_VOICE_ID`), ใช้เฉพาะเมื่อลูกค้าพูดมา |
| Deal Engine (Layer 2) | TypeScript ฟังก์ชันล้วน | ไม่มี I/O ไม่มี LLM |
| ฐานข้อมูล | **Supabase Postgres** (`@supabase/supabase-js`) | Deal Engine เขียนข้อมูลจาก server ด้วย service role key · test ใช้ memory store |
| บัญชีผู้ใช้ | **Supabase Auth** (อีเมล + รหัสผ่าน) ผ่าน `@supabase/ssr` | session เก็บใน cookie · role `owner` / `buyer` อยู่ในตาราง `profiles` |
| Realtime | **Supabase Realtime** | ข้อความใหม่, ดีลใหม่ และข้อความของเถ้าแก่ ส่งถึงจอทันที ไม่ต้อง poll · RLS คุมว่าใครฟังอะไรได้ |
| Test | **Vitest** (+ `tsx` สำหรับรันสคริปต์) | |
| Deploy | **Vercel** | คีย์ทั้งหมดใส่ใน Vercel dashboard |
| ป้องกันฝั่งเซิร์ฟเวอร์ | `server-only`, `proxy.ts` (บังคับล็อกอิน), ตรวจ role ซ้ำใน Data Access Layer | |
| เฟส 11 (ถ้ามีเวลา) | **shadergradient** + **react-three-fiber v9** + three | พื้นหลังเคลื่อนไหว · ไม่ใช้ liquid-glass-js |
| เครื่องมือ dev | ESLint, Node 24, สกิล Claude: superpowers, ui-ux-pro-max | |

### Schema ฐานข้อมูล (MVP)
| ตาราง | เก็บอะไร |
|---|---|
| `profiles` | 1 แถวต่อ 1 บัญชี (`id` = `auth.users.id`): role (`owner`/`buyer`), ชื่อที่ให้ร้านเรียก (เช่น "คุณนก"), วันที่ยอมรับนโยบายความเป็นส่วนตัว |
| `merchants` | ร้าน 1 แถว: ชื่อร้าน, ชื่อเถ้าแก่, cost_of_capital, escalation_deal_value, placeholder ของร้าน (ชื่อบัญชีรับโอน, ช่องทางติดต่อ) |
| `products` | sku, ชื่อ, list/cost/floor, cash_discount, credit_days, volume_tiers (jsonb), ai_enabled |
| `dead_stock` | ของแถม: sku, ทุน, มูลค่าที่ลูกค้ารู้สึก, จำนวนคงเหลือ |
| `chats` | buyer_id (→ profiles), mode (`ai`/`human`), สถานะ, จำนวนครั้งที่ขอต่ำกว่า floor, จำนวนครั้งที่พยายามหลอก |
| `messages` | chat_id, type (ตาม `ChatMessage`), input_mode (`text`/`voice`), เนื้อหา (jsonb), เวลา |
| `offers` | chat_id, A/B/C, lever, ราคา, จำนวน, เงื่อนไข — ยืนยันออเดอร์ด้วย id จากตารางนี้ |
| `deals` | ออเดอร์ที่ปิดได้ + revenue, margin_if_conceded, margin_offer, recovered_margin |
| `escalations` | ประเภท, Deal Brief 3 บรรทัด, chat_id, สถานะ (รอ/ตอบแล้ว) |

**RLS (เปิดทุกตาราง)**
- `buyer` อ่านได้แค่ `chats` / `messages` / `offers` / `deals` ของตัวเองเท่านั้น และไม่มีสิทธิ์อ่าน `products` / `dead_stock` / `merchants` ตรงๆ ข้อมูลสินค้าส่งผ่าน API ที่ตัด cost / floor / margin ออก (`PublicProduct`)
- `owner` อ่านได้ทุกตาราง ส่วนการเขียนสินค้าและการตอบแชตทำผ่าน API ที่ตรวจ role
- การเขียนทุกอย่างของ pipeline ทำจาก server ด้วย service role key ซึ่ง**ห้ามมี `NEXT_PUBLIC_`** และห้าม import ในฝั่ง client
- ไม่ให้ user แก้ role ของตัวเอง: role เริ่มต้นเป็น `buyer` เสมอ ส่วน `owner` ตั้งด้วย SQL ครั้งเดียว

PDPA: เก็บข้อมูลลูกค้าเท่าที่จำเป็น (ชื่อเรียก + อีเมล) ไม่เอาแชตไปเทรนโมเดล ไม่เก็บไฟล์เสียงลูกค้า (แปลงเป็นข้อความแล้วทิ้ง)

## โครงสร้างโปรเจกต์ (เป้าหมาย)
```
C:\dev\dealguard-ai\
  design/                     ← ชุด handoff (reference)
  supabase/migrations/*.sql   ← schema + RLS + trigger สร้าง profile
  proxy.ts                    ← ยังไม่ล็อกอิน → /login
  app/
    layout.tsx, globals.css   ← import design/tokens.css + @theme
    (auth)/login, signup, forgot-password, reset-password, auth/callback
    page.tsx                  ← แชตลูกค้า (Main / Mobile-*)
    order/[id]/page.tsx       ← Mobile-Order
    owner/page.tsx            ← Owner-Desktop / Owner-Mobile
    owner/products/page.tsx   ← Owner-Settings
    owner/chats/[id]/page.tsx ← Owner-Chat
    api/chat/route.ts         ← POST ข้อความลูกค้า → pipeline
    api/transcribe/route.ts   ← POST ไฟล์เสียงลูกค้า → ข้อความ
    api/orders/route.ts       ← ยืนยันข้อเสนอ
    api/owner/...             ← reply, handback, products
  lib/
    deal-engine/              ← โค้ดล้วน ไม่มี I/O (Layer 2) + __tests__
    ai/intent.ts              ← Layer 1 (OpenAI structured output → Intent JSON)
    ai/responder.ts           ← Layer 3 (เรียบเรียงข้อความ)
    ai/validator.ts           ← ตรวจทุกตัวเลขราคาในข้อความเทียบกับ offers
    ai/templates.ts           ← ข้อความสำรอง + mock mode เมื่อไม่มีคีย์
    voice/stt.ts, voice/tts.ts
    supabase/server.ts, client.ts, admin.ts   ← admin = service role (server-only)
    auth/dal.ts               ← getCurrentUser / requireOwner (ตรวจ role ทุก route)
    store/                    ← interface + memory.ts (test) + supabase.ts
    pipeline.ts               ← ต่อ STT → Layer 1→2→3 → TTS
    config/merchant.json      ← seed จาก SKILL §6.2
  components/ui/, components/chat/, components/owner/, components/auth/
```
กฎความปลอดภัยฝั่งโค้ด: `lib/deal-engine`, `lib/config`, `lib/store`, `lib/supabase/admin.ts` ต้องใส่ `import 'server-only'` ส่วน API ที่ลูกค้าเรียกต้องส่งเฉพาะ `PublicProduct` (ไม่มี cost, floor, margin)

---

## เฟส 0 — ตั้งโปรเจกต์และเช็กคีย์
- [x] copy ชุด handoff ไปไว้ที่ `design/`
- [x] สร้างโปรเจกต์ด้วย `create-next-app` (TS, Tailwind v4, App Router, ESLint)
- [x] ติดตั้ง `openai zod @elevenlabs/elevenlabs-js lucide-react server-only` และ dev `vitest vite-tsconfig-paths tsx`
- [x] แปลง `tailwind.preset.js` เป็น `@theme` ใน `globals.css`, import `design/tokens.css`, ฟอนต์ IBM Plex Sans Thai
- [x] แก้ `design/tokens.css` ให้บรรทัด `-webkit-backdrop-filter` มาก่อน เพราะ Lightning CSS เก็บแค่บรรทัดหลังสุด ถ้าไม่สลับ Chrome จะไม่เบลอ
- [x] `.env.example` + `scripts/check-keys.ts` → **ผู้ใช้ใส่คีย์ใน `.env.local` แล้วรัน `npm run check-keys`** (ยังไม่ได้รัน)
- [x] ติดตั้ง `@supabase/supabase-js @supabase/ssr` และเอา `@upstash/redis` ออก
- [ ] **ผู้ใช้สร้างโปรเจกต์ Supabase** แล้วใส่ URL / anon key / service role key ใน `.env.local`
- [x] ลองฟังเสียงผู้ชายในคลัง ElevenLabs 3 เสียง (`npm run voice-samples -- <id>...`) → ทีมเลือก **Eric - Smooth, Trustworthy** (`cjVigY5qzO86Huf0OWal`) กับโมเดล **`eleven_v4_turbo`** · สร้างเสียง 1 ประโยคราว 1.1–1.4 วินาที
- **เสร็จเมื่อ:** check-keys ได้คำตอบจาก GPT ได้ไฟล์เสียงไทยที่ฟังรู้เรื่อง และเชื่อมต่อ Supabase ได้

## เฟส 1 — Deal Engine (MVP ข้อ 1) · ใช้สกิล `test-driven-development`
- [x] `types.ts`: MerchantConfig, Intent, Offer (ตาม HANDOFF §5), EngineResult (`offers | ask_quantity | escalate | accept_list`)
- [x] `offers.ts`: Volume (กฎที่ตกลงไว้), Cash = `max(floor, list × (1 − cash%))`, Bundle (ต้นทุนของแถมรวม < ส่วนต่างราคาเทียบกับราคาที่ขอ และไม่เกิน `qty_available`)
- [x] `margin.ts`: สูตร SKILL §6.5 (`margin_if_conceded`, `margin_offer`, `cash_value`, `recovered_margin`)
- [x] `guard.ts`: Floor Guard แบบ assert ก่อนส่งทุก offer + No Free Concession
- [x] `escalation.ts`: complaint/refund/legal, มูลค่า > `escalation_deal_value`, ต่ำกว่า floor ครบ 3 รอบ, injection ซ้ำ → Deal Brief 3 บรรทัด
- [x] กรณีขอบ: ไม่มีจำนวน → `ask_quantity`, ขอราคา ≥ list → `accept_list`, ไม่บอกราคา → baseline ใช้ list, ไม่มี tier ที่ใหญ่กว่า → ไม่เสนอ Volume
- [x] กฎข้อ C ที่ตกลงเพิ่ม: ราคา = list − 20% ของส่วนที่ขอลด แถมจนคุ้มเท่าข้อ B (บันทึกใน SKILL §6.4)
- โค้ดอยู่ที่ `lib/deal-engine/` (39 tests) · ข้อความ "ราคาปกติ" ของข้อเสนอราคาเต็มเป็นคำที่ผมตั้งเอง รอทีมตรวจ
- **เสร็จเมื่อ:** test ได้ตัวเลขตรงตัวอย่าง SKILL (A +฿20,000 / B ≈ +฿11,332 / C +฿17,000) และไม่มี offer ไหนต่ำกว่า ฿120

## เฟส 2 — UI kit + หน้าแชตลูกค้าแบบ mock (MVP ข้อ 2) · ใช้สกิล `ui-ux-pro-max` ✅
- [x] components ตาม HANDOFF §2 อยู่ใน `components/chat/`, `components/ui/`, `components/order/` (AppBackground = คลาส `.app-bg` บน body, GlassCard = คลาส `.glass` จาก tokens)
- [x] `/` responsive หน้าเดียว (breakpoint 768px): คอมมี drawer ด้านขวา, มือถือใช้ bottom sheet (focus ไปปุ่มปิด, Esc ปิด, ข้างหลังเป็น `inert`, ปิดแล้วคืนโฟกัส)
- [x] ทุก state เปิดดูได้ที่ `/?state=start|product|offers|ordered|text|novoice|guard|escalate` (`lib/chat/scenarios.ts`)
- [x] ChatHeader ใช้ "ออนไลน์ · พิมพ์หรือกดไมค์พูดได้" · Composer มีปุ่มไมค์ 3 สถานะ (ปกติ / กำลังอัด / กำลังแปลงเสียง)
- [x] หน้า `/order/[id]` (Mobile-Order) สำหรับออเดอร์เดโม `demo-A|B|C`
- [x] ตัวตอบจำลอง `lib/chat/mock-responder.ts` ใช้แทน API จนถึงเฟส 4/6 · ข้อเสนอใน mock มี test เช็กว่าตรงกับ Deal Engine จริง
- [x] ความปลอดภัย: `lib/config/storefront.ts` เป็น server-only ส่งเฉพาะข้อมูลสาธารณะเป็น props · สแกน `.next/static` แล้วไม่มี unitCost/floorPrice
- [x] `design/tokens.css` import เข้า `layer(components)` เพื่อให้ utility ของ Tailwind ทับขนาดปุ่มได้
- 124 tests (Vitest + Testing Library) · lint / tsc / build ผ่าน · ตรวจในเบราว์เซอร์ที่ 1440 และ 375 px แล้ว

**ข้อความที่ผมตั้งเอง รอทีมตรวจ:** "กำลังอัดเสียง… กดอีกครั้งเพื่อส่ง", "กำลังแปลงเสียงเป็นข้อความ…", "ไม่พบสินค้า", หัวข้อการ์ดส่งเรื่องตอนกด "คุยกับคนจริง" = "ขอคุยกับคนจริง", ข้อเสนอราคาเต็ม "ราคาปกติ"

**ต่างจากดีไซน์ (ตั้งใจ):**
- มือถือแสดงเงื่อนไขข้อเสนอแบบยาวเหมือนคอม (เช่น "1,000 ชิ้น · โอนทันที ไม่ใช้เครดิต") เพราะ engine ส่งมาข้อความเดียว ถ้าอยากได้แบบสั้นตามดีไซน์ ต้องเพิ่ม field ข้อความสั้นใน Offer
- ข้อความเสียงมี transcript เป็นฟองแยกทั้งคอมและมือถือตาม HANDOFF §2 (ดีไซน์มือถือรวมไว้ในหัวการ์ดข้อเสนอ)
- รายการสินค้าแสดงเฉพาะสินค้าที่มีข้อมูลจริงใน `merchant.json` (ตอนนี้ 1 ตัว) ไม่แสดง placeholder "[สินค้าตัวที่ 3]"
- "วิธีสั่งซื้อ", "ติดต่อร้าน" และปุ่ม "คุยกับเฮียชัยโดยตรง" ในหน้าออเดอร์ แสดงไว้แต่ยังกดไม่ได้ (รอ copy / เฟส 8)

## เฟส 3 — Supabase: schema, RLS, บัญชีผู้ใช้ ✅
- [x] `supabase/migrations/20261023000001_init.sql`: 10 ตาราง + RLS ทุกตาราง + GRANT เอง (ปิด auto-expose ไว้) + trigger สร้าง `profiles` (role = `buyer` เสมอ) + Realtime publication — รันด้วย `npm run db:migrate` (ใช้ `SUPABASE_DB_URL` แบบ Session pooler)
- [x] ตัวเลขหลังบ้านแยกตาราง owner-only: `products`, `dead_stock`, `merchants`, `offer_economics`, `escalations` · ลูกค้าอ่านได้แค่ `chats`/`messages`/`offers`/`orders` ของตัวเอง · เขียนตรงไม่ได้ (ผ่าน server ด้วย service role เท่านั้น)
- [x] `npm run db:seed`: ร้าน + สินค้าจาก `merchant.json` + 4 บัญชียืนยันแล้ว (เถ้าแก่ทีม, กรรมการเถ้าแก่, กรรมการลูกค้า, คุณนก) · รหัสผ่านอยู่ใน `.demo-accounts.local.md` (git ไม่เก็บ) · รันซ้ำไม่เปลี่ยนรหัส
- [x] หน้า `/login`, `/signup` (ติ๊กยอมรับนโยบาย), `/forgot-password`, `/reset-password`, `/auth/callback`, `/privacy` (placeholder), `/owner` ชั่วคราว
- [x] `proxy.ts`: ยังไม่ล็อกอิน → `/login?next=…` (กัน open redirect) · `lib/auth/dal.ts` ตรวจ role ซ้ำทุกหน้า · เถ้าแก่ล็อกอินแล้วไป `/owner`
- [x] ออกจากระบบด้วยฟอร์ม POST `/auth/logout` (โหลดหน้าใหม่ทั้งหน้า กันแชตคนก่อนค้างในหน่วยความจำ + เช็ก origin)
- [x] `getCurrentUser` เรียก `connection()` ก่อนอ่าน session — ไม่งั้น Next 16 error "Date.now() while prerendering" (Supabase เทียบวันหมดอายุ token)
- [x] `npm run test:db`: RLS 14 ข้อบน Supabase จริง (สร้าง/ลบผู้ใช้ชั่วคราวเอง) · unit 152 ข้อ · ตรวจในเบราว์เซอร์: redirect, ล็อกอินลูกค้า/เถ้าแก่, ลูกค้าเข้า /owner ไม่ได้, ออกจากระบบ, รหัสผิด, ฟอร์มสมัครว่าง

- [x] `20261024000002_profile_email.sql`: เก็บอีเมลผู้สมัครใน `profiles` (sync เมื่อเปลี่ยนอีเมล) · เถ้าแก่เห็นอีเมลลูกค้าทุกคน ลูกค้าเห็นแค่ของตัวเอง (RLS 17 ข้อ)
- [x] **ปิด Confirm email แล้ว (ทีมตัดสินใจ 24 ต.ค. 2569):** ลูกค้าสมัครด้วยอีเมลตัวเองแล้วใช้ได้ทันที — ทดสอบสมัครจริงในเบราว์เซอร์แล้ว (ได้ profile ครบ: ชื่อ, อีเมล, role buyer, เวลายอมรับนโยบาย)

**ข้อจำกัดที่ยังอยู่:** "ลืมรหัสผ่าน" ส่งอีเมลได้เฉพาะสมาชิกทีมในโปรเจกต์ Supabase (อีเมลฟรี) — ลูกค้าทั่วไปจะเห็นข้อความให้ติดต่อร้าน · ไม่เช็กว่าอีเมลเป็นของจริง · ถ้าต้องการให้ลูกค้ารีเซ็ตเองได้ ต่อ Gmail SMTP หรือ Resend ภายหลัง

**ข้อความที่ผมตั้งเอง รอทีมตรวจ:** หน้าสมัคร/ล็อกอิน/ลืมรหัสผ่าน, ข้อความ error ภาษาไทย, โครงหน้า `/privacy` (ข้อกฎหมายยังเป็น `[วงเล็บเหลี่ยม]`)

## เฟส 4 — Store + API + Layer 1 (MVP ข้อ 3)
- **โมเดลที่เลือก (วัดจริง 24 ต.ค. 2569):** `OPENAI_MODEL=gpt-4.1-mini` แปลงข้อความไทยเป็น Intent JSON ถูก 4/4 กลางๆ 1.5 วินาที (gpt-4.1-nano / gpt-5.4-nano พลาด 1/4 และช้ากว่า, gpt-5.4-mini ช้าเกินเป้า) · `OPENAI_TRANSCRIBE_MODEL=gpt-4o-mini-transcribe` (ทดสอบจริงในเฟส 6)
- ⚠️ **คำขอแรกหลังว่างนาน (cold start) ใช้ 7–13 วินาที** — ต้องมีวิธีอุ่นการเชื่อมต่อ เช่น เรียก GPT เบาๆ ตอนลูกค้าเปิดหน้าแชต หรือตั้ง timeout + ข้อความสำรอง ให้รวมทั้งหมดยังไม่เกิน 10 วินาที
- [ ] `lib/store`: interface เดียว มี memory impl (test) และ Supabase impl
- [ ] ชื่อลูกค้ามาจาก `profiles` (ไม่ต้องเดาจาก intent แล้ว)
- [ ] `ai/intent.ts`: OpenAI Responses API + zod ตาม SKILL §6.3 ค่าที่ดึงไม่ได้เป็น `null` ไม่มี cost/floor ใน prompt ถ้าไม่มีคีย์ใช้ regex parser แทน
- [ ] จับ injection สองชั้น: `injection_suspected` จาก LLM + heuristic ("ลืมคำสั่ง", "ignore previous" ฯลฯ)
- [ ] `POST /api/chat` → `pipeline.ts` ถ้าแชตอยู่โหมด human ให้เก็บข้อความอย่างเดียว AI ไม่ตอบ
- **เสร็จเมื่อ:** test ของ intent กับข้อความใน acceptance table ได้ JSON ถูกต้อง ทั้ง mock และของจริง

## เฟส 5 — Layer 3 + เลือกข้อเสนอ + ออเดอร์ (MVP ข้อ 4)
- [ ] `ai/responder.ts`: ไม่เกิน 60 คำ เรียกชื่อลูกค้า ข้อความแรกบอกว่าเป็น "ผู้ช่วย AI ของเฮียชัย" ใช้ "ครับ" ส่งเฉพาะตัวเลขของ offers เข้า prompt
- [ ] `ai/validator.ts`: ตัวเลขทุกตัวในข้อความต้องตรงกับ offers และห้ามมีคำสัญญาต้องห้าม (ส่งฟรี/คืนเงิน/รับประกัน) ถ้าไม่ผ่านใช้ template แทน
- [ ] ตอบตาม Mobile-Guard และ Mobile-Escalate
- [ ] `POST /api/orders`: ดึง offer จากตาราง `offers` ตาม id และเช็กว่าเป็นแชตของ user คนนี้ ไม่รับตัวเลขจาก client → บันทึก `deals`
- [ ] หน้า `/order/[id]` (เปิดได้เฉพาะเจ้าของออเดอร์และ owner)
- **เสร็จเมื่อ:** flow start→ordered วิ่งได้จริง และ acceptance 7 ข้อแรกใน SKILL §7 ผ่านเป็น integration test

## เฟส 6 — เสียง: ไมค์ + เสียง AI (MVP ข้อ 5)
- [ ] ไมค์: `MediaRecorder` อัดเสียง → `POST /api/transcribe` → OpenAI แปลงเป็นข้อความไทย → แสดงเป็นฟองข้อความลูกค้า แล้วส่งเข้า pipeline พร้อม `input_mode: 'voice'`
- [ ] รองรับ Safari (ไฟล์ mp4) และ Chrome (webm) · ถ้าไม่อนุญาตไมค์หรือแปลงไม่ได้ ให้บอกลูกค้าแล้วให้พิมพ์แทน
- [ ] TTS: เฉพาะตอบข้อความที่ `input_mode = 'voice'` ใช้เสียงผู้ชายจากคลัง timeout ประมาณ 4–5 วินาที ส่งเสียงกลับเป็น base64 แล้ว client สร้าง blob URL ไม่เก็บเสียงลงฐานข้อมูล
- [ ] VoiceBubble + transcript ถ้า TTS พังให้ขึ้น `voice_unavailable` + ข้อความ (Mobile-NoVoice)
- [ ] วัด latency ลง log (STT / parse / engine / write / TTS) เป้าคือนับจากลูกค้าพูดจบจนได้เสียงตอบ ≤ 10 วินาที
- **เสร็จเมื่อ:** พูด "ขอ 125 ได้ไหม 1,000 ชิ้น" แล้วได้เสียงไทยตอบพร้อม 3 ข้อเสนอ, พิมพ์ข้อความเดียวกันแล้วได้ข้อความอย่างเดียว, ปิดคีย์ ElevenLabs แล้วยังได้ข้อความกับข้อเสนอ

## เฟส 7 — หน้าเถ้าแก่ `/owner` (MVP ข้อ 6)
- [ ] OwnerSidebar (คอม) / bottom nav (มือถือ), StatTile × 3, ProfitChart (grouped bar ทำด้วย SVG เอง), DealsTable/DealsList, EscalationRow
- [ ] subscribe Realtime ตาราง `deals` / `escalations` ให้ตัวเลข "เด้ง" ทันทีที่ลูกค้ายืนยัน (สคริปต์เดโมข้อ 3)
- **เสร็จเมื่อ:** เปิดสองเบราว์เซอร์ (ลูกค้า + เถ้าแก่) ลูกค้าปิดดีลแล้วหน้าเถ้าแก่อัปเดตภายใน 1–2 วินาที

## เฟส 8 — Owner-Chat: เถ้าแก่ตอบเอง
- [ ] `ChatMessage` แบบ `owner_text` และ chat `mode: 'ai' | 'human'` (escalate แล้วเปลี่ยนเป็น human อัตโนมัติ)
- [ ] `/owner/chats/[id]`: Deal Brief, ประวัติแชต (ลูกค้าใช้ไอคอนคน), chip คำตอบด่วน, ช่องตอบ "ในชื่อเฮียชัย", ปุ่ม "ให้ AI ตอบต่อ"
- [ ] ฝั่งลูกค้าใช้ Realtime รับข้อความเถ้าแก่ แสดง HandoffCard / "รอเฮียชัยตอบ"
- [ ] ปุ่ม "คุยกับคนจริง" ทุกจอ → escalation ประเภทลูกค้าขอเอง → โหมด human
- **เสร็จเมื่อ:** "ของเสีย ขอคืนเงิน" → AI หยุดตอบ → เถ้าแก่ตอบ → ลูกค้าเห็นทันที → กดคืนให้ AI แล้ว AI ตอบต่อได้

## เฟส 9 — ตั้งค่าสินค้า `/owner/products` (MVP ข้อ 7)
- [ ] ฟอร์มตาม Owner-Settings: ราคาขาย/ต้นทุน/พื้น, PriceRangeBar, TierRow, ส่วนลดจ่ายสด, เครดิต, ต้นทุนเงินทุน, ของแถม, เกณฑ์ escalate, Toggle "ให้ AI ต่อราคาสินค้านี้"
- [ ] validate ฝั่ง server: floor ≥ cost, tier price ≥ floor, list ≥ floor ถ้าไม่ผ่านไม่บันทึก
- [ ] ถ้าเวลาไม่พอ ให้หน้านี้อ่านอย่างเดียว
- **เสร็จเมื่อ:** แก้ floor แล้วข้อเสนอถัดไปเปลี่ยนตาม และใส่ tier ต่ำกว่า floor แล้วโดนปฏิเสธ

## เฟส 10 — Deploy Vercel + ซ้อมเดโม
- [ ] ผูก Supabase กับโปรเจกต์ Vercel และตั้ง Site URL / Redirect URLs ใน Supabase Auth ให้ตรงกับโดเมน Vercel (ไม่งั้นลิงก์รีเซ็ตรหัสผ่านพัง)
- [ ] **ผู้ใช้ใส่คีย์ทั้งหมดใน Vercel dashboard เอง**
- [ ] deploy preview → รัน acceptance 8 ข้อบน URL จริง → ซ้อมสคริปต์ 60 วินาทีและจับเวลา
- [ ] เตรียมบัญชีลูกค้าเดโม ("คุณนก") ที่ล็อกอินค้างไว้ก่อนขึ้นเวที เพราะการล็อกอินจะกินเวลาเดโม
- [ ] ปุ่ม reset ข้อมูลเดโม (เฉพาะ owner)
- **เสร็จเมื่อ:** สคริปต์เดโม SKILL §7 วิ่งครบบน URL Vercel โดยไม่ต้องแก้อะไรเพิ่ม

## เฟส 11 — ขัดเงา / ถ้ามีเวลา
- shadergradient เป็นพื้นหลังเคลื่อนไหว (`@shadergradient/react @react-three/fiber@^9 three three-stdlib camera-controls`) โหลดแบบ dynamic ปิดเมื่อ `prefers-reduced-motion` บนมือถือใช้ CSS mesh เดิม และต้องเช็ก contrast ≥ 4.5:1
- โหมดถามข้อมูลทั่วไป (SKILL §11.3), นำเข้าจาก Excel (SKILL §11.5)

---

## Verification (ทุกเฟส)
- จบแต่ละเฟสต้องรัน `npm test`, `npm run lint`, `npm run build` ให้ผ่านก่อน (สกิล `verification-before-completion`)
- เฟสที่มี UI: เปิด dev server ใน browser pane แล้วเทียบกับไฟล์ดีไซน์ที่ 1440 กับ 390 px
- เฟส 5 ขึ้นไป: รัน acceptance table ของ SKILL §7 เป็น integration test ทั้ง mock mode และ live mode
- commit ทีละเฟสเมื่อผู้ใช้สั่งเท่านั้น
