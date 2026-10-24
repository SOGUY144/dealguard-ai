# DealGuard AI — UX/UI Handoff (สำหรับ Claude Code)

> เอกสารนี้คือ "สเปกหน้าตา" ของเว็บ DealGuard ส่วน "สเปกระบบ" (Deal Engine, Layer 1/2/3, กฎราคา) อยู่ใน `SKILL.md` ของโปรเจกต์ — อ่านคู่กันเสมอ
> ไฟล์ใน `screens/` คือดีไซน์ต้นฉบับทุกจอ ใช้เป็น **reference หน้าตา** (สี ระยะ ขนาด ข้อความ) ไม่ต้องเอาไปรันตรงๆ

> **เปลี่ยนแปลงหลังส่งดีไซน์ (ทีมตัดสินใจ 23 ต.ค. 2569) — ข้อนี้ทับข้อความในไฟล์ดีไซน์**
> - ไม่ใช้เสียงเถ้าแก่: ใช้**เสียง AI ผู้ชาย**จากคลัง ElevenLabs ข้อความยังใช้ "ครับ"
> - header แชตใช้ "ออนไลน์ · พิมพ์หรือกดไมค์พูดได้" แทน "ตอบด้วยเสียงเฮียชัย (ได้รับอนุญาต)" (กฎข้อ 3 ใน §6 ด้วย)
> - ตอบตามแบบที่ลูกค้าใช้: กดไมค์พูด → VoiceBubble + transcript, พิมพ์ → ข้อความอย่างเดียว (ไม่มี VoiceBubble) · ปุ่มไมค์ใน Composer ใช้งานจริง
> - ทุกคนต้องล็อกอินก่อนเข้าเว็บ (อีเมล + รหัสผ่าน) หน้าสมัคร / ล็อกอิน / ลืมรหัสผ่าน ไม่มีในไฟล์ดีไซน์ ให้ทำด้วย tokens และคลาสกระจกเดิม
> - ชื่อลูกค้าในแชต (เช่น "คุณนก (คุณ)") มาจากชื่อที่ลูกค้ากรอกตอนสมัคร
> - ใบสรุปออเดอร์ (Mobile-Order): "{เถ้าแก่}จะยืนยันวันส่งของในแชต หรือทักร้านทาง [ช่องทางติดต่อของร้าน]" แทน "…ทาง [ช่องทาง]" — ระบบไม่มี LINE ของลูกค้า เถ้าแก่ตอบได้ทางแชตเท่านั้น (รีวิว 24 ต.ค. 2569)

---

## 0. วิธีอ่านไฟล์ `screens/*.dc.html`

ไฟล์เป็น HTML + inline style ที่ใช้ template ของเครื่องมือออกแบบ แปลงเป็น React แบบนี้:

| ในไฟล์ | ความหมาย | ใน React |
|---|---|---|
| `<x-dc>…</x-dc>` | ตัวหน้าจอ | JSX ของ component |
| `<helmet>` | font link + CSS พื้นฐาน | `app/layout.tsx` / globals.css |
| `{{ name }}` | ค่าจาก `renderVals()` | `{name}` |
| `<sc-for list="{{items}}" as="x">` | วนลูป | `items.map(x => …)` |
| `<sc-if value="{{cond}}">` | แสดงตามเงื่อนไข | `{cond && …}` |
| `onClick="{{fn}}"` | event | `onClick={fn}` |
| `class Component extends DCLogic { renderVals() }` | state + ค่าที่ใช้ใน template | `useState` + ตัวแปรใน component |
| `<a href="X.dc.html">` | ลิงก์ระหว่างจอ | `next/link` ไป route ตามตารางหมวด 3 |
| `data-props` → `startStage` | ตัวเลือกจอเริ่มต้นสำหรับเดโม | ไม่ต้องทำ (state จริงมาจากแชต) |

ข้อความภาษาไทยในไฟล์คือ copy จริงที่ใช้ได้เลย ส่วนที่อยู่ใน `[วงเล็บเหลี่ยม]` เช่น `[ราคา]` `[ชื่อบัญชีร้าน]` คือ placeholder ที่ต้องเติมข้อมูลจริง ห้ามแต่งเอง

---

## 1. Design tokens

ไฟล์พร้อมใช้: `tokens.css` (CSS variables + utility classes) และ `tailwind.preset.js`

### สี
| Token | ค่า | ใช้ที่ |
|---|---|---|
| `--bg` | `#F6F3FB` | พื้นหลังหน้า (ใต้ mesh) |
| mesh | ชมพู `#FBE4EF` · ลาเวนเดอร์ `#E4DAFB` · ฟ้า `#DCE5FF` · ม่วงอ่อน `#EFE6FC` | radial-gradient 3–4 วงที่มุมหน้า (ดู `.app-bg`) |
| `--ink` | `#2B2D3E` | ตัวหนังสือหลัก |
| `--ink-2` | `#34364C` | ตัวหนังสือรองบนพื้นสี |
| `--muted` | `#5F6178` | caption, label, เวลา |
| `--accent` | `#7A5AE0` | สีหลัก (ม่วง) — จุดสถานะ, ข้อเสนอที่เลือก, กราฟ |
| `--accent-ink` | `#5B3FC4` | ตัวหนังสือสีม่วงบนพื้นอ่อน |
| `--accent-ink-strong` | `#4B2FB0` | ตัวหนังสือปุ่มหลัก |
| `--accent-tint` | `#EFE9FD` | ฟองข้อความลูกค้า, avatar AI, เมนู active |
| `--accent-tint-2` | `#F4EFFE` | ข้อเสนอที่เลือก (พื้น) |
| `--accent-surface` | `#FAF8FE` | การ์ดข้อเสนอที่ยังไม่เลือก |
| `--accent-border` | `#D9CCF9` | ขอบ composer, chip คำตอบด่วน |
| `--line` | `#E6DEF5` | เส้นคั่น, ขอบ input |
| `--line-soft` | `#F1ECFA` | ขอบฟองข้อความ, เส้นตาราง |
| `--warn` / `--warn-ink` / `--warn-bg` | `#C2570C` / `#8A3C0B` / `#FDF0E6` | เรื่องรอเถ้าแก่ตัดสินเท่านั้น (badge, chip) |
| `--ok-ink` / `--ok-bg` | `#1D6B4A` / `#E3F4EB` | ป้าย "ผ่าน" เช่น ทุกขั้นไม่ต่ำกว่าราคาพื้น |
| `--voice` | `#2B2D3E` | แคปซูลข้อความเสียง (จุดเดียวที่ใช้สีเข้ม) |
| chart | ถ้ายอมลด `#3E9BD6` · ข้อเสนอ AI `#7A5AE0` | กราฟกำไรต่อดีล (ผ่าน CVD check แล้ว) |

กฎ: ม่วงใช้เฉพาะสิ่งที่กดได้/สถานะ · ส้มใช้เฉพาะเรื่องต้องให้เถ้าแก่ตัดสิน · **ไม่มีพื้นสีดำ** ยกเว้นแคปซูลเสียง

### ตัวอักษร
- ฟอนต์เดียว: **IBM Plex Sans Thai** (300–700) จาก Google Fonts, fallback `'Leelawadee UI', Tahoma, sans-serif`
- ตัวเลขใช้ `font-variant-numeric: tabular-nums`
- ภาษาไทย: `line-height` ≥ 1.4 สำหรับหัวข้อ, 1.55–1.65 สำหรับเนื้อหา · **ห้ามใส่ letter-spacing กับภาษาไทย**
- ขนาด: H1 28 (คอม) / 24 (มือถือ) · หัวข้อ section 17–19 · เนื้อหา 14–15 · caption 12–13 · ตัวเลขเด่น 30–42 weight 600

### รูปทรง ระยะ เงา
- ปุ่ม/chip/header: `border-radius: 999px` · การ์ดใหญ่ 22–30px · การ์ดย่อย/input 14–18px
- ระยะห่าง section 22px · ในการ์ด 10–16px · padding หน้า 24–32px (คอม) / 12–16px (มือถือ)
- Touch target ทุกปุ่ม ≥ 44px
- เงามาตรฐาน: `0 16px 40px rgba(110,90,170,0.10)` (การ์ด) · `0 8px 22px rgba(110,90,170,0.10)` (composer)

### สูตรกระจก (glass) — ใช้ซ้ำทั้งเว็บ
| Class | ใช้กับ |
|---|---|
| `.glass` | การ์ดทั่วไป, sidebar, drawer, แชต |
| `.glass-clear` | การ์ดตัวเลข (stat tiles) — ใสแบบ iOS ต้องมีวงสีจางๆ ข้างหลังถึงจะเห็นความใส |
| `.glass-pill` | header แบบแคปซูลลอย, bottom nav มือถือ |
| `.btn-primary` | ปุ่มหลัก: กระจกขาวแต้มม่วงอ่อน ตัวหนังสือ `#4B2FB0` |
| `.btn-secondary` | ปุ่มรอง: กระจกขาวใส ตัวหนังสือ `#5B3FC4` |

ค่าจริงอยู่ใน `tokens.css` — ผู้ใช้ปฏิเสธปุ่มม่วงทึบไล่สีแล้ว (ดู "ดูเป็น AI เกินไป") **อย่ากลับไปใช้ปุ่มม่วงทึบ**

### ไอคอน
- เส้น (stroke 2, round) ขนาด 16–20px แนะนำ `lucide-react` ให้ตรงกับดีไซน์ (grid, help-circle, message-circle, user, mic, arrow-right, x, search, lock, shield, bell, tag, clock, list)
- **AI = ไอคอนดาวประกาย (sparkle)** ทุกที่ที่ลูกค้าเห็น · **ลูกค้า = ไอคอนคน** ในหน้าที่เถ้าแก่ดูแชต
- ห้ามใช้ emoji

---

## 2. Components ที่ต้องทำ

| Component | อยู่ในจอ | หมายเหตุ |
|---|---|---|
| `AppBackground` | ทุกจอ | mesh gradient (`.app-bg`) |
| `GlassCard` | ทุกจอ | variant: `glass` / `glass-clear` |
| `Button` | ทุกจอ | variant: `primary` / `secondary` / `chip` (ขอบ `--accent-border` พื้นขาว) |
| `StoreHeader` | Main | แคปซูลลอย: ชื่อร้าน + segmented nav (active = พื้นขาวนูนในราง `rgba(239,233,253,.8)`) |
| `ChatHeader` | แชตทุกจอ | avatar AI (sparkle บน gradient ม่วง) + "ผู้ช่วย AI ของเฮียชัย" + สถานะ + ปุ่ม "คุยกับคนจริง" (ต้องมีทุกจอ) |
| `MessageRow` | แชต | `role: ai | buyer | system` · AI ซ้าย ฟองขาว มุมบนซ้าย 6px · ลูกค้าขวา ฟอง `--accent-tint` มุมบนขวา 6px · ชื่อ + เวลาเหนือฟอง (คอม) |
| `VoiceBubble` | แชต | แคปซูล `--voice` + waveform แท่งขาว + เวลา + ปุ่มเล่นวงกลมขาว · มี transcript เป็นฟองขาวตามมาเสมอ |
| `OfferList` / `OfferCard` | แชต | ตัวอักษร A/B/C ในวงกลม, ชื่อ lever, ราคา/ชิ้น, เงื่อนไข, ยอดรวม · selected: ขอบ 2px `--accent` พื้น `--accent-tint-2` · ปุ่ม "ยืนยันข้อ X · ฿ยอด" |
| `ProductCardMessage` | แชต | การ์ดสินค้าที่ลูกค้าเลือก ส่งเข้าแชตฝั่งลูกค้า |
| `OrderSummaryCard` | แชต / Mobile-Order | แถว dashed, ยอดรวมตัวใหญ่, คำเตือน "รับโอนเข้าบัญชี [ชื่อบัญชีร้าน] เท่านั้น" (พื้นส้มอ่อน) |
| `SystemNotice` | แชต | chip กลางจอ: `price_locked` (ไอคอนกุญแจ) / `escalated` / `voice_unavailable` (ไอคอนลำโพงขีดฆ่า) |
| `HandoffCard` | Mobile-Escalate | การ์ดขาว "ส่งเรื่องให้เฮียชัยแล้ว" + สถานะ + เรื่อง/ออเดอร์/ช่องทางตอบกลับ (โทนปกติ ไม่ใช้ส้ม) |
| `Composer` | แชต | กล่องขาวขอบ `--accent-border` radius 22: input บน, แถวล่าง [สินค้า][ไมค์] ··· [ส่ง] · chip คำตอบด่วนเหนือกล่อง |
| `ProductDrawer` (คอม) / `ProductSheet` (มือถือ) | Main / Mobile-Product | ค้นหา + การ์ดสินค้า + ปุ่ม "ขอต่อราคา" · มือถือเป็น bottom sheet มี backdrop `rgba(43,45,62,.35)` |
| `OwnerSidebar` | Owner-Desktop, Owner-Settings | ไม่มีโลโก้ มีแค่คำว่า DealGuard · badge ส้มที่ "รอตัดสิน" |
| `StatTile` | Owner | `glass-clear` + chip ไอคอนสี (ม่วง/ฟ้า/เขียว) |
| `ProfitChart` | Owner | grouped bar 2 สี, ตัวเลขกำกับบนแท่ง AI, legend ด้านบน, tooltip ต่อแท่ง |
| `DealsTable` / `DealsList` | Owner | คอม = ตาราง (ไม่มีคอลัมน์ Deal score) · มือถือ = รายการ |
| `EscalationRow` | Owner | ไอคอนส้ม + ประเภท·เวลา + สรุปบรรทัดเดียว + ปุ่ม "ตอบ" |
| `PriceRangeBar` | Owner-Settings | แถบ ต้นทุน→พื้น (ลายทาง "AI เสนอต่ำกว่านี้ไม่ได้") → ขาย (ม่วง "ช่วงที่ AI ต่อรองได้") |
| `TierRow`, `Toggle` | Owner-Settings | toggle ใช้ `<button aria-pressed>` |

---

## 3. หน้าจอ → Route

| ไฟล์ดีไซน์ | Route ที่แนะนำ | หมายเหตุ |
|---|---|---|
| `Main.dc.html` | `/` (ลูกค้า, คอม) | แชต + drawer สินค้าด้านขวา · state ในไฟล์ = flow จริง |
| `Mobile-Product.dc.html` | `/` (มือถือ, sheet เปิด) | ไม่ใช่หน้าแยก — คือ `ProductSheet` ตอนเปิด |
| `Mobile-Chat.dc.html` | `/` (มือถือ) | หน้าเดียวกับ Main แต่ layout มือถือ |
| `Mobile-Order.dc.html` | `/order/[id]` | ใบสรุปเต็มจอ เปิดจากปุ่ม "ดูใบสรุปออเดอร์" |
| `Mobile-Guard.dc.html` | state ใน `/` | ลูกค้าพยายามหลอก / ถามต้นทุน |
| `Mobile-Escalate.dc.html` | state ใน `/` | AI ส่งต่อให้เถ้าแก่ |
| `Mobile-NoVoice.dc.html` | state ใน `/` | Voice API ล่ม → ข้อความอย่างเดียว |
| `Owner-Desktop.dc.html` / `Owner-Mobile.dc.html` | `/owner` | responsive หน้าเดียว (sidebar คอม / bottom nav มือถือ) |
| `Owner-Settings.dc.html` | `/owner/products` | (MVP ข้อ 7 — ถ้าไม่ทัน ใช้ JSON ตายตัวตาม SKILL) |
| `Owner-Chat.dc.html` | `/owner/chats/[id]` | เถ้าแก่ตอบเอง + ปุ่ม "ให้ AI ตอบต่อ" |

Responsive: ใช้ breakpoint เดียว ~`768px` · คอม = drawer/sidebar ด้านข้าง · มือถือ = sheet/bottom nav

---

## 4. Flow แชตลูกค้า (Main / Mobile-Chat)

```
start   → AI ทัก (บอกว่าเป็นผู้ช่วย AI) + ปุ่ม "ดูสินค้าทั้งหมด"
product → ลูกค้าเลือกสินค้า → ProductCardMessage → AI ถามจำนวน+ราคา (1 คำถาม)
offers  → ลูกค้าพิมพ์ เช่น "ขอ 125 ได้ไหม 1,000 ชิ้น" → VoiceBubble + transcript + OfferList (3 ข้อ)
ordered → เลือก + ยืนยัน → ข้อความ "เลือกข้อ X" → OrderSummaryCard
```
ทุกอย่างอยู่ในแชต ไม่เปลี่ยนหน้า · `ProductDrawer` เปิด/ปิดได้ตลอดจากปุ่ม "สินค้า" ใน composer

---

## 5. Data ที่ UI ต้องการ (มาจาก backend ตาม SKILL หมวด 6)

```ts
type Offer = {
  id: 'A' | 'B' | 'C';
  lever: 'volume' | 'cash' | 'bundle';
  label: string;          // "ซื้อเยอะ" | "จ่ายสด" | "รับของแถม"
  pricePerUnit: number;   // มาจาก Deal Engine (Layer 2) เท่านั้น
  qty: number;
  conditionText: string;  // "เมื่อสั่ง 1,500 ชิ้น"
  total: number;
  creditDays: number;     // 0 = โอนทันที
  bundle?: { name: string; qty: number };
};

type ChatMessage =
  | { type: 'ai_text'; text: string; at: string }
  | { type: 'ai_voice'; audioUrl: string; durationSec: number; transcript: string; at: string }
  | { type: 'buyer_text'; text: string; at: string }
  | { type: 'product_card'; sku: string; name: string; listPrice: number; at: string }
  | { type: 'offers'; offers: Offer[]; selectedId?: Offer['id'] }
  | { type: 'order_summary'; offer: Offer; productName: string }
  | { type: 'system'; kind: 'price_locked' | 'escalated' | 'voice_unavailable' };

type ClosedDeal = { at: string; buyer: string; offer: Offer; revenue: number;
  marginIfConceded: number; marginOffer: number; recoveredMargin: number };

type Escalation = { id: string; kind: 'over_value' | 'refund' | 'complaint' | 'below_floor_3x' | 'injection';
  at: string; buyer: string; brief: [string, string, string]; chatId: string };
```

---

## 6. กฎที่ห้ามพลาด (จาก SKILL)

1. UI **ไม่คำนวณราคาเอง** — แสดงเฉพาะตัวเลขจาก Deal Engine
2. ฝั่งลูกค้า **ห้ามแสดงต้นทุน ราคาพื้น หรือ margin** (แสดงได้แค่ในหน้าเถ้าแก่)
3. ข้อความแรกของทุกแชตต้องบอกว่าเป็น "ผู้ช่วย AI ของเฮียชัย" · header แสดง "เสียงเฮียชัย (ได้รับอนุญาต)"
4. ปุ่ม "คุยกับคนจริง" ต้องมีทุกจอแชต
5. Voice API ล่ม → ยังต้องส่งข้อความ + ข้อเสนอได้ (`Mobile-NoVoice`)
6. ไม่สัญญาสิ่งที่ไม่อยู่ในข้อเสนอ (ส่งฟรี/คืนเงิน) → ส่งต่อเถ้าแก่ (`Mobile-Escalate`)
7. ตัดทิ้งจาก MVP: LINE, login/หลายร้าน, PDF quote, ชำระเงินจริง

## 7. Accessibility
- ปุ่มใช้ `<button>` / ลิงก์ใช้ `<a>` จริง · icon-only ต้องมี `aria-label`
- `<input>` ทุกตัวมี `<label>` (ซ่อนได้ด้วย `.sr-only`)
- ข้อเสนอใช้ `aria-pressed` · กราฟมี `role="img"` + `aria-label` สรุปตัวเลข
- contrast ตัวหนังสือ ≥ 4.5:1 (ระวังตัวเล็กบนพื้นกระจกที่มีสีข้างหลัง)

## 8. ตัวเลขในดีไซน์
ตัวเลขดีล (฿130×1,500, recovered +฿20,000 / +฿11,332 / +฿17,000, รวม ฿48,332) มาจากตัวอย่างใน SKILL หมวด 6.5
`฿475,000` = ผลรวมยอด 3 ดีล (คำนวณเอง) · ลูกค้า 2–3, เวลา, `[วันที่]` เป็นข้อมูลเดโม ต้องแทนด้วยข้อมูลจริง
