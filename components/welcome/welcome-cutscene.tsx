"use client";

import { Check, LoaderCircle, Store } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { Component, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { welcomeStore, type Welcome } from "@/lib/welcome/store";
import { WelcomeBot, type BotPose } from "./welcome-bot";

/** จังหวะของคัตซีน (ms นับจากเริ่ม) — ทั้งเรื่องราว 5 วินาที กดข้ามได้ตลอด */
export const STEPS = {
  bot: 60,
  title: 550,
  phone: 1250,
  ask: 1500,
  typing: 1950,
  offers: 2550,
  pick: 3250,
  deal: 3750,
} as const;
/** เริ่มพาไปหน้าปลายทางตั้งแต่ตอนปิดดีล หน้าใหม่โหลดอยู่ข้างหลังระหว่างฉลอง */
export const NAVIGATE_AT = STEPS.deal;
/** จางออกได้เร็วสุดตอนนี้ (ถ้าหน้าใหม่มาแล้ว) */
export const MIN_END = 5000;
export const LEAVE_MS = 700;
/** หน้าใหม่ยังไม่มาจริงๆ → โหลดหน้าใหม่ทั้งหน้าแทน ไม่ค้างอยู่ในคัตซีน */
export const HARD_NAV_AFTER = 12000;

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

const subscribe = welcomeStore.subscribe;
const getWelcome = () => welcomeStore.get();
const noWelcome = () => null;

export function WelcomeCutscene({ storeName }: { storeName: string }) {
  const welcome = useSyncExternalStore(subscribe, getWelcome, noWelcome);
  if (!welcome) return null;
  // key: ล็อกอินใหม่ = เริ่มเรื่องใหม่ทั้งหมด
  return (
    <GoOnError key={`${welcome.to}|${welcome.name}`} to={welcome.to}>
      <Cutscene welcome={welcome} storeName={storeName} />
    </GoOnError>
  );
}

/** คัตซีนอยู่ใน root layout — ถ้าพังต้องไม่ลากทั้งเว็บไป global-error: ข้ามคัตซีน พาไปหน้าปลายทางเลย */
class GoOnError extends Component<{ to: string; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    console.error("[welcome] คัตซีนพัง ข้ามไปหน้าปลายทาง", error);
    welcomeStore.finish();
    window.location.assign(this.props.to);
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

type Step = keyof typeof STEPS;

function Cutscene({ welcome, storeName }: { welcome: Welcome; storeName: string }) {
  const router = useRouter();
  const pathname = usePathname();
  // หน้าที่อยู่ตอนเริ่ม (หน้าล็อกอิน) — path เปลี่ยน = หน้าปลายทางมาแล้ว
  const [startPath] = useState(pathname);
  const navigated = pathname !== startPath;
  const skipButton = useRef<HTMLButtonElement>(null);

  const [elapsed, setElapsed] = useState(0);
  const [skipped, setSkipped] = useState(false);
  const [reduced] = useState(() => window.matchMedia(REDUCED_MOTION).matches);
  const navStarted = useRef(false);
  // หน้าใหม่มาแล้ว + เล่นจบ (หรือกดข้าม) → จางออก
  const leaving = !reduced && navigated && (skipped || elapsed >= MIN_END);
  const shouldNavigate = reduced || skipped || elapsed >= NAVIGATE_AT;

  // นาฬิกาของเรื่อง: เดินทีละจังหวะ (ไม่ต้อง re-render ทุกเฟรม)
  useEffect(() => {
    if (reduced) return;
    const marks = [...Object.values(STEPS), MIN_END];
    const timers = marks.map((at) => window.setTimeout(() => setElapsed(at), at));
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [reduced]);

  // ตั้งค่าลดการเคลื่อนไหวไว้ → ไม่เล่นคัตซีน พาไปเลย · กดข้าม / ถึงตอนปิดดีล → เริ่มพาไปหน้าปลายทาง
  useEffect(() => {
    if (!shouldNavigate || navStarted.current) return;
    navStarted.current = true;
    router.replace(welcome.to);
  }, [shouldNavigate, router, welcome.to]);

  useEffect(() => {
    if (reduced && navigated) welcomeStore.finish();
  }, [reduced, navigated]);

  useEffect(() => {
    if (!leaving) return;
    const t = window.setTimeout(() => welcomeStore.finish(), LEAVE_MS);
    return () => window.clearTimeout(t);
  }, [leaving]);

  // กันค้าง: เน็ตช้า/หน้าใหม่ไม่มาสักที → เปิดหน้าใหม่แบบเต็มหน้า
  useEffect(() => {
    const t = window.setTimeout(() => window.location.assign(welcome.to), HARD_NAV_AFTER);
    return () => window.clearTimeout(t);
  }, [welcome.to]);

  // ระหว่างคัตซีน: ล็อกการเลื่อนหน้า · โฟกัสปุ่มข้าม · Esc = ข้าม
  useEffect(() => {
    if (reduced) return;
    const html = document.documentElement;
    const before = html.style.overflow;
    html.style.overflow = "hidden";
    skipButton.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSkipped(true);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      html.style.overflow = before;
      window.removeEventListener("keydown", onKey);
    };
  }, [reduced]);

  if (reduced) return null;

  const at = (step: Step) => skipped || elapsed >= STEPS[step];
  const pose: BotPose = at("deal") ? "happy" : at("phone") ? "chat" : "wave";
  const greeting =
    welcome.role === "owner" ? "วันนี้ผมช่วยตอบแชตลูกค้าแทนเถ้าแก่นะครับ" : `ผมคือผู้ช่วย AI ของ${storeName} ต่อราคาให้ได้ทันที`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`ยินดีต้อนรับ คุณ${welcome.name}`}
      data-leaving={leaving}
      className="cs-root app-bg fixed inset-0 z-[1000] overflow-hidden"
    >
      <div aria-hidden="true" className="cs-glow" />
      <p role="status" className="sr-only">
        เข้าสู่ระบบแล้ว กำลังพาเข้า{storeName}
      </p>

      <button
        ref={skipButton}
        type="button"
        onClick={() => setSkipped(true)}
        className="absolute right-4 top-4 z-10 flex h-10 items-center rounded-full border border-white/90 bg-white/70 px-4 text-sm font-semibold text-accent-ink shadow-soft backdrop-blur focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent md:right-6 md:top-6"
      >
        ข้าม
      </button>

      <div className="cs-stage relative mx-auto flex h-full w-full max-w-[920px] flex-col items-center justify-center gap-4 px-4 py-14 md:flex-row md:gap-14">
        {/* มาสคอต + คำทักทาย */}
        <div className="flex flex-col items-center text-center md:w-[340px]">
          <div className="cs-bot" data-show={at("bot")}>
            <div className="cs-hop">
              <WelcomeBot pose={pose} className="h-[132px] w-auto md:h-[250px]" />
            </div>
          </div>
          <h2 className="cs-item mt-2 text-xl font-semibold md:mt-4 md:text-[28px]" data-show={at("title")}>
            สวัสดีครับ คุณ{welcome.name}
          </h2>
          <p className="cs-item mt-1 max-w-[300px] text-sm leading-normal text-muted md:text-[15px]" data-show={at("title")}>
            {greeting}
          </p>
        </div>

        {/* จอแชตย่อ: บอทคุยกับลูกค้าจริงแบบสั้นๆ */}
        <div aria-hidden="true" className="cs-phone glass relative w-full max-w-[340px] rounded-card p-3.5 md:p-4" data-show={at("phone")}>
          <div className="mb-3 flex items-center gap-2.5 border-b border-line-soft pb-3">
            <span className="flex size-9 items-center justify-center rounded-full bg-accent-tint text-accent-ink">
              <Store aria-hidden="true" size={18} />
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-semibold">{storeName}</span>
              <span className="flex items-center gap-1.5 text-xs text-muted">
                <span className="size-1.5 rounded-full bg-ok-ink" />
                ผู้ช่วย AI ตอบอยู่
              </span>
            </span>
          </div>

          <div className="flex flex-col gap-2 text-[13px] leading-[1.5] md:text-sm">
            <div className="cs-msg bubble-buyer self-end" data-show={at("ask")}>
              ขอ ฿125 ได้ไหมครับ 1,000 ชิ้น
            </div>

            {/* จุดพิมพ์อยู่กับคำตอบในช่องเดียวกัน — ไม่ดันหน้าตอนสลับ */}
            <div className="grid self-start">
              <div className="cs-msg bubble-ai col-start-1 row-start-1 self-start" data-show={at("typing") && !at("offers")}>
                <span className="cs-typing" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </span>
              </div>
              <div className="cs-msg bubble-ai col-start-1 row-start-1 flex flex-col gap-2" data-show={at("offers")}>
                <span>฿125 ให้ไม่ได้ครับ แต่มี 3 ทางที่ถูกลง</span>
                <span className="flex flex-col gap-1.5">
                  <Offer letter="A" label="ซื้อ 1,500 ชิ้น" price="฿130" />
                  <Offer letter="B" label="จ่ายสด" price="฿135" picked={at("pick")} />
                  <Offer letter="C" label="รับของแถม" price="฿145" />
                </span>
              </div>
            </div>

            <div className="cs-msg bubble-buyer self-end" data-show={at("pick")}>
              เอาข้อ B ครับ
            </div>
          </div>

          {/* ปิดดีล */}
          <div className="cs-deal" data-show={at("deal")}>
            <span className="flex size-11 items-center justify-center rounded-full bg-ok-ink text-white shadow-soft">
              <Check aria-hidden="true" size={24} strokeWidth={3} />
            </span>
            <span className="text-lg font-semibold text-ok-ink">ปิดดีลแล้ว</span>
            <span className="text-[13px] text-muted">ร้านยังได้กำไร ไม่ต่ำกว่าราคาที่ตั้งไว้</span>
          </div>
        </div>
      </div>

      <p
        className="cs-item absolute inset-x-0 bottom-5 flex items-center justify-center gap-2 px-4 text-center text-[13px] text-muted md:bottom-8"
        data-show={at("deal")}
      >
        <LoaderCircle aria-hidden="true" size={15} className="animate-spin text-accent" />
        กำลังพาเข้า{welcome.role === "owner" ? "หน้าเถ้าแก่" : "ร้าน"}…
      </p>
    </div>
  );
}

function Offer({ letter, label, price, picked = false }: { letter: string; label: string; price: string; picked?: boolean }) {
  return (
    <span
      data-picked={picked}
      className="cs-offer flex items-center gap-2 rounded-xl border border-line bg-accent-surface px-2.5 py-1.5"
    >
      <span className="flex size-5 items-center justify-center rounded-full bg-accent-tint text-[11px] font-bold text-accent-ink">
        {letter}
      </span>
      <span className="flex-1">{label}</span>
      <span className="font-semibold text-accent-ink">{price}</span>
    </span>
  );
}
