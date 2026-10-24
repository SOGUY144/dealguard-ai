"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Suggestion } from "@/lib/chat/actions";
import type { MockContext } from "@/lib/chat/mock-responder";
import type { ScenarioName } from "@/lib/chat/scenarios";
import type { PublicProduct, Storefront } from "@/lib/chat/types";
import { DESKTOP_QUERY, useMediaQuery } from "@/lib/use-media-query";
import { ChatHeader } from "./chat-header";
import { ChatThread, messageElementId } from "./chat-thread";
import { Composer, type VoiceState } from "./composer";
import { ProductDrawer, ProductSheet } from "./product-panel";
import { StoreHeader } from "./store-header";
import { browserVoice, useChatSession, type LiveChat } from "./use-chat-session";
import type { Recorder } from "./voice-input";
import { unlockVoicePlayback } from "./voice-player";

type Props = {
  storefront: Storefront;
  products: PublicProduct[];
  buyerName: string;
  /** เปิดจาก state ในไฟล์ดีไซน์ (ใช้ตรวจหน้าตา) */
  scenario?: ScenarioName;
  /** แสดงปุ่มออกจากระบบ (ผู้ใช้ล็อกอินอยู่) */
  canLogout?: boolean;
  /** แชตจริงผ่าน /api/chat (ไม่ใส่ = ตัวตอบจำลอง) — scenario ชนะเสมอ */
  live?: LiveChat;
  /** server มีคีย์แปลงเสียง → ปุ่มไมค์ในแชตจริงใช้ได้ */
  voiceInput?: boolean;
};

/** อัดได้นานสุดเท่านี้ แล้วส่งให้เอง */
const MAX_RECORD_MS = 30_000;

// เฟส 2: ยังไม่มีไมค์จริง จำลองว่าแปลงเสียงได้ประโยคเดโมนี้ (เฟส 6 ใช้ STT จริง)
const MOCK_TRANSCRIPT = "ขอ 125 ได้ไหมคะ 1,000 ชิ้น ร้านข้างๆ ให้ 110";
const MOCK_TRANSCRIBE_MS = 1200;

/** หน้าแชตลูกค้า (Main / Mobile-*) — responsive หน้าเดียว breakpoint 768px */
function scrollToMessage(id: string) {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  document.getElementById(messageElementId(id))?.scrollIntoView({
    behavior: reduce ? "auto" : "smooth",
    block: "center",
  });
}

export function ChatScreen({ storefront, products, buyerName, scenario, canLogout, live, voiceInput = false }: Props) {
  const ctx: MockContext = { storefront, products, buyerName, now: () => new Date().toISOString() };
  const productImages = Object.fromEntries(products.flatMap((p) => (p.imageUrl ? [[p.sku, p.imageUrl]] : [])));
  const { view: chat, pending, dispatch, autoPlayId } = useChatSession({
    live: scenario ? undefined : live,
    scenario,
    mockContext: ctx,
    onFocus: scrollToMessage,
  });
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [voiceNotice, setVoiceNotice] = useState<string | null>(null);
  const recorder = useRef<Recorder | null>(null);
  const autoStop = useRef<ReturnType<typeof setTimeout>>(undefined);
  const liveMode = Boolean(live) && !scenario;
  const transcribeTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const isDesktop = useMediaQuery(DESKTOP_QUERY);

  // กำลังขอสิทธิ์ไมค์ — กดซ้ำระหว่างนี้ไม่เริ่มอัดตัวที่สอง (ไม่งั้นไมค์ตัวแรกค้าง)
  const startingMic = useRef(false);
  // เสียงที่แปลงแล้วแต่ส่งไม่สำเร็จ → ใส่กลับในช่องพิมพ์
  const [prefill, setPrefill] = useState<{ text: string; n: number } | null>(null);

  useEffect(
    () => () => {
      clearTimeout(transcribeTimer.current);
    },
    [],
  );
  // ออกจากหน้า (Next 16 ซ่อนหน้าไว้ด้วย <Activity> แทนการปิด) → ปิดไมค์ทันที ทิ้งเสียงที่อัดค้าง
  // useLayoutEffect = cleanup ทำก่อนหน้าถูกซ่อน ไม่มีช่วงที่ไมค์ยังเปิดอยู่
  const onScreen = useRef(false);
  useLayoutEffect(() => {
    onScreen.current = true;
    return () => {
      onScreen.current = false;
      clearTimeout(autoStop.current);
      recorder.current?.cancel();
      recorder.current = null;
      setVoiceState((v) => (v === "recording" ? "idle" : v));
    };
  }, []);

  const lastOf = <T extends string>(type: T) => [...chat.messages].reverse().find((m) => m.type === type);
  const activeCard = lastOf("product_card");
  const activeSku = activeCard?.type === "product_card" ? activeCard.sku : undefined;

  function openProducts() {
    if (isDesktop) setDrawerOpen(true);
    else setSheetOpen(true);
  }

  function toggleProducts() {
    if (isDesktop) setDrawerOpen((open) => !open);
    else setSheetOpen(true);
  }

  function askAbout(sku: string) {
    void dispatch({ type: "pick_product", sku });
    setSheetOpen(false);
  }

  function showOffers() {
    const offers = lastOf("offers");
    if (offers) scrollToMessage(offers.id);
  }

  function onSuggestion(s: Suggestion) {
    if (s.action.type === "open_products") return openProducts();
    void dispatch(s.action);
    // chip ที่เลือกข้อเสนอเดิม → พาไปดูการ์ดข้อเสนอที่ถูกเลือก
    if (s.action.type === "select_offer") scrollToMessage(s.action.messageId);
  }

  async function stopAndSend() {
    clearTimeout(autoStop.current);
    const rec = recorder.current;
    recorder.current = null;
    if (!rec || !live) return;
    setVoiceState("transcribing");
    try {
      const audio = await rec.stop();
      const text = (await (live.voice ?? browserVoice).transcribe(audio)).trim();
      if (!text) {
        setVoiceNotice("ไม่ได้ยินเสียงพูด ลองพูดอีกครั้ง หรือพิมพ์แทนได้เลยครับ");
        return;
      }
      setVoiceState("idle");
      const sent = await dispatch({ type: "send", text, inputMode: "voice" });
      if (!sent) {
        // ส่งไม่สำเร็จ (ระบบล่ม / กำลังตอบข้อความก่อน) — ไม่ทิ้งสิ่งที่พูด ใส่ไว้ในช่องพิมพ์ให้กดส่งเอง
        setPrefill((p) => ({ text, n: (p?.n ?? 0) + 1 }));
        setVoiceNotice("ส่งเสียงไม่สำเร็จ ข้อความที่พูดอยู่ในช่องพิมพ์แล้ว กดส่งได้เลยครับ");
      }
    } catch {
      setVoiceNotice("แปลงเสียงไม่สำเร็จ ลองอีกครั้ง หรือพิมพ์แทนได้เลยครับ");
    } finally {
      setVoiceState("idle");
    }
  }

  async function onLiveMicPress() {
    if (voiceState === "transcribing" || !live || startingMic.current) return;
    if (voiceState === "recording") return stopAndSend();
    setVoiceNotice(null);
    // iPhone เล่นเสียงตอบเองได้เฉพาะเมื่อปลดล็อกจากการแตะ — ปลดตอนกดไมค์ (คำตอบมาหลังจากนี้หลายวินาที)
    unlockVoicePlayback();
    const rec = (live.voice ?? browserVoice).recorder();
    startingMic.current = true;
    try {
      await rec.start();
    } catch {
      setVoiceNotice("ใช้ไมค์ไม่ได้ อนุญาตไมค์ในเบราว์เซอร์ หรือพิมพ์แทนได้เลยครับ");
      return;
    } finally {
      startingMic.current = false;
    }
    // ออกจากหน้าระหว่างรอสิทธิ์ไมค์ → ไม่เริ่มอัดบนหน้าที่ซ่อนอยู่
    if (!onScreen.current) return rec.cancel();
    recorder.current = rec;
    setVoiceState("recording");
    autoStop.current = setTimeout(() => void stopAndSend(), MAX_RECORD_MS);
  }

  function onMicPress() {
    if (liveMode) return void onLiveMicPress();
    if (voiceState === "idle") {
      setVoiceState("recording");
      return;
    }
    if (voiceState === "recording") {
      setVoiceState("transcribing");
      clearTimeout(transcribeTimer.current);
      transcribeTimer.current = setTimeout(() => {
        void dispatch({ type: "send", text: MOCK_TRANSCRIPT, inputMode: "voice" });
        setVoiceState("idle");
      }, MOCK_TRANSCRIBE_MS);
    }
  }

  const placeholder =
    chat.mode === "human"
      ? `พิมพ์ข้อความถึง${storefront.ownerName}`
      : isDesktop
        ? "พิมพ์จำนวนกับราคาที่อยากได้ เช่น 1,000 ชิ้น ราคา 125"
        : "พิมพ์จำนวนกับราคาที่อยากได้";

  // ตอน bottom sheet เปิด เนื้อหาข้างหลังต้องกด/โฟกัสไม่ได้ ไม่งั้นโฟกัสจะไปซ่อนอยู่หลัง sheet
  const sheetShowing = sheetOpen && !isDesktop;

  return (
    <div className="flex h-dvh flex-col md:h-auto md:min-h-dvh md:pb-7">
      <StoreHeader storeName={storefront.storeName} tagline={storefront.tagline} canLogout={canLogout} />

      <main
        inert={sheetShowing}
        className="flex min-h-0 flex-1 md:mx-auto md:w-full md:max-w-[1320px] md:flex-none md:gap-5 md:px-8 md:pt-5"
      >
        <section
          aria-label="แชตต่อราคา"
          className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden md:h-[clamp(560px,calc(100dvh-140px),800px)] md:flex-[999_1_560px] md:rounded-[30px] md:border md:border-white/95 md:bg-white/62 md:shadow-[0_18px_44px_rgba(110,90,170,0.12)] md:backdrop-blur-[16px]"
        >
          <ChatHeader
            assistantName={storefront.assistantName}
            onTalkToHuman={() => void dispatch({ type: "talk_to_human" })}
            busy={pending}
            canLogout={canLogout}
          />

          {/* column-reverse: แชตเริ่มชิดล่างและค้างอยู่ที่ข้อความล่าสุดเสมอ */}
          <div className="flex min-h-0 flex-1 flex-col-reverse overflow-y-auto overscroll-contain">
            <ChatThread
              messages={chat.messages}
              storefront={storefront}
              buyerName={buyerName}
              pending={pending}
              mode={chat.mode}
              autoPlayId={autoPlayId}
              simulateVoice={!liveMode}
              productImages={productImages}
              today={live && !scenario ? new Date() : undefined}
              onSelectOffer={(messageId, offerId) => void dispatch({ type: "select_offer", messageId, offerId })}
              onConfirmOffer={(messageId, offerId) => void dispatch({ type: "confirm_offer", messageId, offerId })}
              onOpenProducts={openProducts}
              onShowOffers={showOffers}
            />
          </div>

          <Composer
            placeholder={placeholder}
            suggestions={chat.suggestions}
            productsOpen={isDesktop ? drawerOpen : sheetOpen}
            voiceState={voiceState}
            busy={pending}
            // แชตจริงยังไม่มีการแปลงเสียง — ห้ามส่งประโยคเดโมเข้าแชตของลูกค้า (เฟส 6 ใช้ STT จริง)
            micAvailable={!liveMode || voiceInput}
            voiceNotice={voiceNotice}
            prefill={prefill}
            onSend={(text) => dispatch({ type: "send", text, inputMode: "text" })}
            onSuggestion={onSuggestion}
            onToggleProducts={toggleProducts}
            onMicPress={onMicPress}
          />
        </section>

        {drawerOpen && (
          <ProductDrawer
            products={products}
            activeSku={activeSku}
            onAsk={askAbout}
            onClose={() => setDrawerOpen(false)}
            busy={pending}
          />
        )}
      </main>

      {sheetShowing && (
        <ProductSheet
          products={products}
          activeSku={activeSku}
          onAsk={askAbout}
          onClose={() => setSheetOpen(false)}
          busy={pending}
        />
      )}
    </div>
  );
}
