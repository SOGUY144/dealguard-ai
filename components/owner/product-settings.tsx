"use client";

// หน้าตั้งค่าสินค้า (Owner-Settings.dc.html) — เถ้าแก่ตั้งราคา/ขั้นราคา/เงื่อนไขแลกส่วนลด แล้ว Deal Engine ใช้ตัวเลขนี้ทุกดีล
// ข้อความแจ้งข้อผิด / "บันทึกแล้ว" / หมายเหตุเงื่อนไขส่งเถ้าแก่ ไม่มีในไฟล์ดีไซน์ แต่งเพิ่ม ต้องให้ทีมตรวจ
import { Check, FileSpreadsheet, Lock, Plus, TriangleAlert, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useMemo, useState, type ReactNode } from "react";
import { buttonClass } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { formatBaht, formatQty } from "@/lib/format";
import {
  MAX_TIERS,
  validateSettings,
  type FieldErrors,
  type GiftInfo,
  type ProductSettingsForm,
  type ProductSettingsPage,
  type SaveResult,
} from "@/lib/owner/product-settings";

type Props = { page: ProductSettingsPage; save: (form: ProductSettingsForm) => Promise<SaveResult> };
type SavedProduct = ProductSettingsPage["products"][number];

/** ค่าในช่องกรอกเป็นตัวอักษร (ลบจนว่างได้) — แปลงเป็นตัวเลขตอนตรวจ/บันทึก */
type Draft = {
  listPrice: string;
  unitCost: string;
  floorPrice: string;
  tiers: { key: number; minQty: string; price: string }[];
  cashDiscountPct: string;
  defaultCreditDays: string;
  costOfCapitalPct: string;
  escalationDealValue: string;
  aiEnabled: boolean;
  gifts: Record<string, boolean>;
};

let nextKey = 0;
const toNum = (s: string) => (s.trim() === "" ? Number.NaN : Number(s.replace(/,/g, "")));

function toDraft(p: SavedProduct): Draft {
  return {
    listPrice: String(p.listPrice),
    unitCost: String(p.unitCost),
    floorPrice: String(p.floorPrice),
    tiers: p.tiers.map((t) => ({ key: nextKey++, minQty: String(t.minQty), price: String(t.price) })),
    cashDiscountPct: String(p.cashDiscountPct),
    defaultCreditDays: String(p.defaultCreditDays),
    costOfCapitalPct: String(p.costOfCapitalPct),
    escalationDealValue: p.escalationDealValue.toLocaleString("en-US"),
    aiEnabled: p.aiEnabled,
    gifts: Object.fromEntries(p.gifts.map((g) => [g.sku, g.enabled])),
  };
}

function toForm(sku: string, d: Draft): ProductSettingsForm {
  return {
    sku,
    listPrice: toNum(d.listPrice),
    unitCost: toNum(d.unitCost),
    floorPrice: toNum(d.floorPrice),
    tiers: d.tiers.map((t) => ({ minQty: toNum(t.minQty), price: toNum(t.price) })),
    cashDiscountPct: toNum(d.cashDiscountPct),
    defaultCreditDays: toNum(d.defaultCreditDays),
    aiEnabled: d.aiEnabled,
    costOfCapitalPct: toNum(d.costOfCapitalPct),
    escalationDealValue: toNum(d.escalationDealValue),
    gifts: Object.entries(d.gifts).map(([giftSku, enabled]) => ({ sku: giftSku, enabled })),
  };
}

type Status = { kind: "idle" } | { kind: "saving" } | { kind: "saved" } | { kind: "error"; message: string };

export function ProductSettings({ page, save }: Props) {
  const router = useRouter();
  const [sku, setSku] = useState(page.products[0]?.sku ?? "");
  const saved = page.products.find((p) => p.sku === sku);
  const [draft, setDraft] = useState<Draft | null>(() => (saved ? toDraft(saved) : null));
  const [serverErrors, setServerErrors] = useState<FieldErrors>({});
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const form = useMemo(() => (draft ? toForm(sku, draft) : null), [draft, sku]);
  const errors = useMemo(() => ({ ...serverErrors, ...(form ? validateSettings(form) : {}) }), [form, serverErrors]);

  if (!saved || !draft || !form) {
    return <p className="text-sm text-muted">ยังไม่มีสินค้าในร้าน</p>;
  }

  const edit = (patch: Partial<Draft>) => {
    setDraft((d) => (d ? { ...d, ...patch } : d));
    setServerErrors({});
    if (status.kind !== "saving") setStatus({ kind: "idle" });
  };
  const editTier = (key: number, patch: Partial<Draft["tiers"][number]>) =>
    edit({ tiers: draft.tiers.map((t) => (t.key === key ? { ...t, ...patch } : t)) });

  function choose(next: SavedProduct) {
    setSku(next.sku);
    setDraft(toDraft(next));
    setServerErrors({});
    setStatus({ kind: "idle" });
  }

  async function onSave() {
    if (!form || Object.keys(validateSettings(form)).length > 0) {
      setStatus({ kind: "error", message: "ยังบันทึกไม่ได้ แก้ช่องที่ขึ้นสีส้มก่อน" });
      return;
    }
    setStatus({ kind: "saving" });
    try {
      const result = await save(form);
      if (result.ok) {
        setStatus({ kind: "saved" });
        router.refresh();
        return;
      }
      const { form: formError, ...fieldErrors } = result.errors;
      setServerErrors(fieldErrors);
      setStatus({ kind: "error", message: formError ?? "ยังบันทึกไม่ได้ แก้ช่องที่ขึ้นสีส้มก่อน" });
    } catch {
      setStatus({ kind: "error", message: "บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง" });
    }
  }

  const tierBelowFloor = form.tiers.some((t) => Number.isFinite(t.price) && t.price < form.floorPrice);
  const lastTier = form.tiers.at(-1);

  return (
    <div className="flex flex-col gap-[22px]">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col">
          <h1 className="text-2xl leading-[1.35] font-semibold md:text-[28px]">สินค้าและราคา</h1>
          <span className="text-sm text-muted">ตั้งครั้งเดียว AI ใช้ตัวเลขนี้ทุกดีล และแก้ตัวเลขเองไม่ได้</span>
        </div>
        {/* ยังไม่อยู่ใน MVP (SKILL §11.5) — แสดงตามดีไซน์แต่กดไม่ได้ */}
        <div className="flex flex-wrap gap-2.5">
          <button type="button" disabled className={buttonClass("secondary", "h-[46px] px-[18px] text-sm font-medium")}>
            <FileSpreadsheet aria-hidden="true" size={17} />
            นำเข้าจาก Excel
          </button>
          <button type="button" disabled className={buttonClass("primary", "h-[46px] px-5 text-sm font-semibold")}>
            <Plus aria-hidden="true" size={17} />
            เพิ่มสินค้า
          </button>
        </div>
      </header>

      <div className="flex flex-wrap items-start gap-[22px]">
        <ProductList products={page.products} gifts={page.gifts} current={sku} onChoose={choose} />

        <section
          aria-label={`ตั้งค่า${saved.name}`}
          className="glass flex min-w-0 flex-[999_1_520px] flex-col gap-6 rounded-[26px] px-4 py-5 md:px-6 md:py-[22px]"
        >
          <div className="flex flex-wrap items-center gap-3.5">
            <Thumb size="size-14 rounded-2xl" />
            <div className="flex min-w-0 flex-auto flex-col">
              <h2 className="text-xl leading-[1.4] font-semibold">{saved.name}</h2>
              <span className="text-[13px] text-muted">SKU {saved.sku}</span>
            </div>
            <button
              type="button"
              aria-pressed={draft.aiEnabled}
              onClick={() => edit({ aiEnabled: !draft.aiEnabled })}
              className="flex h-11 items-center gap-2.5 rounded-full border border-white/90 bg-white/70 pr-2 pl-4 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              ให้ AI ต่อราคาสินค้านี้
              <Switch on={draft.aiEnabled} />
            </button>
          </div>

          <div className="flex flex-col gap-3.5">
            <h3 className="text-base font-semibold">ราคา</h3>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(170px,100%),1fr))] gap-3.5">
              <Field label="ราคาขาย" prefix="฿" value={draft.listPrice} onChange={(v) => edit({ listPrice: v })} error={errors.listPrice} />
              <Field
                label={<>ต้นทุน <Hidden /></>}
                prefix="฿"
                value={draft.unitCost}
                onChange={(v) => edit({ unitCost: v })}
                error={errors.unitCost}
              />
              <Field
                label={
                  <>
                    <Lock aria-hidden="true" size={13} className="text-accent-ink" />
                    ราคาพื้น <Hidden />
                  </>
                }
                prefix="฿"
                value={draft.floorPrice}
                onChange={(v) => edit({ floorPrice: v })}
                error={errors.floorPrice}
                emphasis
              />
            </div>
            <PriceRangeBar cost={form.unitCost} floor={form.floorPrice} list={form.listPrice} />
          </div>

          <Divider />

          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2.5">
              <h3 className="text-base font-semibold">ราคาตามจำนวน</h3>
              {tierBelowFloor ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-warn-bg px-3 py-1 text-xs font-semibold text-warn-ink">
                  <TriangleAlert aria-hidden="true" size={13} />
                  มีขั้นที่ต่ำกว่าราคาพื้น
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-ok-bg px-3 py-1 text-xs font-semibold text-ok-ink">
                  <Check aria-hidden="true" size={13} />
                  ทุกขั้นไม่ต่ำกว่าราคาพื้น
                </span>
              )}
            </div>
            <ul className="flex flex-col gap-2">
              {draft.tiers.map((t, i) => (
                <TierRow
                  key={t.key}
                  minQty={t.minQty}
                  price={t.price}
                  margin={form.tiers[i].price - form.unitCost}
                  qtyError={errors[`tiers.${i}.minQty`]}
                  priceError={errors[`tiers.${i}.price`]}
                  onQty={(v) => editTier(t.key, { minQty: v })}
                  onPrice={(v) => editTier(t.key, { price: v })}
                  onRemove={() => edit({ tiers: draft.tiers.filter((x) => x.key !== t.key) })}
                />
              ))}
            </ul>
            {errors.tiers && <p className="text-xs text-warn-ink">{errors.tiers}</p>}
            <button
              type="button"
              disabled={draft.tiers.length >= MAX_TIERS}
              onClick={() =>
                edit({
                  tiers: [
                    ...draft.tiers,
                    {
                      key: nextKey++,
                      minQty: String(Number.isFinite(lastTier?.minQty) ? (lastTier?.minQty ?? 0) * 2 || 100 : 100),
                      price: draft.floorPrice,
                    },
                  ],
                })
              }
              className="h-10 self-start rounded-full border border-dashed border-[#B9A5F0] px-4 text-[13px] font-medium text-accent-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50"
            >
              + เพิ่มขั้น
            </button>
          </div>

          <Divider />

          <div className="flex flex-col gap-3">
            <h3 className="text-base font-semibold">ส่วนลดต้องแลกกับอะไร</h3>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(170px,100%),1fr))] gap-3.5">
              <Field label="ลดเพิ่มเมื่อจ่ายสด" suffix="%" value={draft.cashDiscountPct} onChange={(v) => edit({ cashDiscountPct: v })} error={errors.cashDiscountPct} />
              <Field label="เครดิตปกติ" suffix="วัน" value={draft.defaultCreditDays} onChange={(v) => edit({ defaultCreditDays: v })} error={errors.defaultCreditDays} />
              <Field
                label="ต้นทุนเงินทุน"
                suffix="% ต่อปี"
                value={draft.costOfCapitalPct}
                onChange={(v) => edit({ costOfCapitalPct: v })}
                error={errors.costOfCapitalPct}
                hint="ใช้คิดว่าลูกค้าจ่ายสดคุ้มกับร้านแค่ไหน"
              />
            </div>
            {page.gifts.map((g) => (
              <GiftRow
                key={g.sku}
                gift={g}
                on={draft.gifts[g.sku] ?? g.enabled}
                onToggle={() => edit({ gifts: { ...draft.gifts, [g.sku]: !(draft.gifts[g.sku] ?? g.enabled) } })}
              />
            ))}
          </div>

          <Divider />

          <fieldset className="flex flex-col gap-3">
            <legend className="mb-3 text-base font-semibold">ส่งให้เถ้าแก่ตัดสินเมื่อ</legend>
            <EscalationValue value={draft.escalationDealValue} onChange={(v) => edit({ escalationDealValue: v })} error={errors.escalationDealValue} />
            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(260px,100%),1fr))] gap-2">
              {["ลูกค้าขอคืนเงินหรือร้องเรียน", "ยืนยันราคาต่ำกว่าพื้นครบ 3 รอบ", "มีคนพยายามหลอกระบบซ้ำ"].map((label) => (
                <label key={label} className="flex min-h-11 items-center gap-2.5 rounded-[14px] bg-white/70 px-3 py-2 text-sm">
                  <input type="checkbox" checked disabled readOnly className="size-5 flex-none accent-accent" />
                  {label}
                </label>
              ))}
            </div>
            {/* กฎความปลอดภัย (SKILL §6.8): เรื่องคืนเงิน/ต่ำกว่าพื้น/หลอกระบบต้องถึงเถ้าแก่เสมอ */}
            <span className="text-xs text-muted">3 ข้อนี้เปิดไว้เสมอ เพื่อให้เรื่องสำคัญถึงเถ้าแก่ทุกครั้ง</span>
          </fieldset>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <span className="flex-[1_1_240px] text-[13px] text-muted">บันทึกแล้วมีผลกับแชตลูกค้าทันที</span>
            <button
              type="button"
              onClick={() => choose(saved)}
              disabled={status.kind === "saving"}
              className={buttonClass("secondary", "h-12 px-5 font-medium")}
            >
              ยกเลิก
            </button>
            <button
              type="button"
              onClick={onSave}
              aria-busy={status.kind === "saving"}
              disabled={status.kind === "saving"}
              className={buttonClass("primary", "h-12 px-7 font-semibold")}
            >
              บันทึก
            </button>
          </div>
          <div aria-live="polite" className="-mt-3 text-right text-sm empty:hidden">
            {status.kind === "saving" && <span className="text-muted">กำลังบันทึก…</span>}
            {status.kind === "saved" && (
              <span role="status" className="text-ok-ink">
                บันทึกแล้ว แชตลูกค้าใช้ราคาใหม่ตั้งแต่ข้อความถัดไป
              </span>
            )}
            {status.kind === "error" && (
              <span role="alert" className="text-warn-ink">
                {status.message}
              </span>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function ProductList({
  products,
  gifts,
  current,
  onChoose,
}: {
  products: SavedProduct[];
  gifts: GiftInfo[];
  current: string;
  onChoose: (p: SavedProduct) => void;
}) {
  return (
    <section aria-label="รายการสินค้า" className="glass flex min-w-0 flex-[1_1_260px] flex-col gap-1.5 rounded-3xl p-2.5 md:max-w-[320px]">
      {products.map((p) => {
        const active = p.sku === current;
        return (
          <button
            key={p.sku}
            type="button"
            aria-current={active ? "true" : undefined}
            onClick={() => onChoose(p)}
            className={cn(
              "flex items-center gap-3 rounded-[18px] p-2.5 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
              active && "bg-accent-tint/85 shadow-[0_0_0_2px_var(--accent)]",
            )}
          >
            <Thumb size="size-12 rounded-[14px]" />
            <span className="flex min-w-0 flex-auto flex-col">
              <span className="text-sm leading-[1.4] font-semibold">{p.name}</span>
              <span className="text-xs text-muted">
                {formatBaht(p.listPrice)} · พื้น {formatBaht(p.floorPrice)}
                {!p.aiEnabled && " · AI ไม่ต่อราคา"}
              </span>
            </span>
          </button>
        );
      })}
      {gifts.map((g) => (
        <div key={g.sku} className="flex items-center gap-3 rounded-[18px] p-2.5">
          <Thumb size="size-12 rounded-[14px]" />
          <span className="flex min-w-0 flex-auto flex-col">
            <span className="text-sm leading-[1.4] font-semibold">{g.name}</span>
            <span className="text-xs text-muted">
              {g.enabled ? "ใช้เป็นของแถม" : "ไม่ใช้เป็นของแถม"} · เหลือ {formatQty(g.qtyAvailable)} ชิ้น
            </span>
          </span>
        </div>
      ))}
    </section>
  );
}

function Thumb({ size }: { size: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("flex-none", size)}
      style={{ background: "radial-gradient(circle at 30% 25%, #FFFFFF 0, #EEE5FD 45%, #D6C8F8 100%)" }}
    />
  );
}

function Hidden() {
  return <span className="font-normal text-muted">(ลูกค้าไม่เห็น)</span>;
}

function Divider() {
  return <div aria-hidden="true" className="h-px bg-line/90" />;
}

function Switch({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn("relative inline-block h-[26px] w-11 flex-none rounded-full transition-colors", on ? "bg-accent" : "bg-line")}
    >
      <span
        className={cn(
          "absolute top-[3px] size-5 rounded-full bg-white shadow-[0_2px_4px_rgba(0,0,0,0.15)] transition-[left] motion-reduce:transition-none",
          on ? "left-[21px]" : "left-[3px]",
        )}
      />
    </span>
  );
}

function Field({
  label,
  value,
  onChange,
  error,
  prefix,
  suffix,
  hint,
  emphasis,
}: {
  label: ReactNode;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  prefix?: string;
  suffix?: string;
  hint?: string;
  emphasis?: boolean;
}) {
  const id = useId();
  const describedBy = [error && `${id}-error`, hint && `${id}-hint`].filter(Boolean).join(" ") || undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="flex items-center gap-1.5 text-[13px] font-medium">
        {label}
      </label>
      <div
        className={cn(
          "flex h-12 items-center gap-1.5 rounded-[14px] px-3.5 focus-within:outline-2 focus-within:outline-offset-1 focus-within:outline-accent",
          error
            ? "border-[1.5px] border-warn bg-warn-bg"
            : emphasis
              ? "border-[1.5px] border-[#B9A5F0] bg-accent-tint/85"
              : "border border-line bg-white/85",
        )}
      >
        {prefix && <span className={emphasis ? "text-accent-ink" : "text-muted"}>{prefix}</span>}
        <input
          id={id}
          type="number"
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(
            "h-11 min-w-0 flex-auto bg-transparent text-base outline-none",
            emphasis ? "font-semibold text-accent-strong" : "font-medium",
          )}
        />
        {suffix && <span className="whitespace-nowrap text-muted">{suffix}</span>}
      </div>
      {error && (
        <span id={`${id}-error`} className="text-xs text-warn-ink">
          {error}
        </span>
      )}
      {hint && (
        <span id={`${id}-hint`} className="text-xs text-muted">
          {hint}
        </span>
      )}
    </div>
  );
}

/** แถบ ต้นทุน → พื้น (ลายทาง) → ขาย (ม่วง) — HANDOFF PriceRangeBar */
function PriceRangeBar({ cost, floor, list }: { cost: number; floor: number; list: number }) {
  if (![cost, floor, list].every(Number.isFinite) || !(cost <= floor && floor <= list && cost < list)) return null;
  const floorAt = ((floor - cost) / (list - cost)) * 100;
  const b = (n: number) => formatQty(n);
  return (
    <div
      role="img"
      aria-label={`ช่วงราคา ต้นทุน ${b(cost)} บาท ราคาพื้น ${b(floor)} บาท ราคาขาย ${b(list)} บาท AI ต่อรองได้ระหว่าง ${b(floor)} ถึง ${b(list)} บาท`}
      className="flex flex-col gap-1.5 pt-1"
    >
      <div className="relative flex h-9 overflow-hidden rounded-xl border border-white/90 text-xs">
        <div
          className="flex items-center justify-center overflow-hidden font-medium whitespace-nowrap text-[#4A4C63]"
          style={{
            flex: `0 0 ${floorAt}%`,
            background: "repeating-linear-gradient(135deg, #EFEAF8 0, #EFEAF8 6px, #E4DCF4 6px, #E4DCF4 12px)",
          }}
        >
          {floorAt >= 25 && "AI เสนอต่ำกว่านี้ไม่ได้"}
        </div>
        <div
          className="flex flex-auto items-center justify-center overflow-hidden font-semibold whitespace-nowrap"
          style={{ background: "linear-gradient(90deg, #D9CCF9 0%, #C6B4F6 100%)" }}
        >
          {100 - floorAt >= 25 && "ช่วงที่ AI ต่อรองได้"}
        </div>
      </div>
      <div className="relative h-5 text-xs text-[#4A4C63]">
        <span className="absolute left-0">ต้นทุน {formatBaht(cost)}</span>
        {floorAt > 18 && floorAt < 82 && (
          <span className="absolute -translate-x-1/2 font-semibold text-accent-ink" style={{ left: `${floorAt}%` }}>
            พื้น {formatBaht(floor)}
          </span>
        )}
        <span className="absolute right-0">ขาย {formatBaht(list)}</span>
      </div>
      <span className="text-[13px] text-muted">
        กำไรต่อชิ้นที่ราคาพื้น {formatBaht(floor - cost)} · ที่ราคาขาย {formatBaht(list - cost)}
      </span>
    </div>
  );
}

function TierRow({
  minQty,
  price,
  margin,
  qtyError,
  priceError,
  onQty,
  onPrice,
  onRemove,
}: {
  minQty: string;
  price: string;
  margin: number;
  qtyError?: string;
  priceError?: string;
  onQty: (v: string) => void;
  onPrice: (v: string) => void;
  onRemove: () => void;
}) {
  const id = useId();
  const box = (error?: string) =>
    cn(
      "flex h-[42px] items-center gap-1.5 rounded-xl px-3 focus-within:outline-2 focus-within:outline-offset-1 focus-within:outline-accent",
      error ? "border-[1.5px] border-warn bg-warn-bg" : "border border-line bg-white",
    );
  return (
    <li className="flex flex-col gap-1 rounded-2xl bg-white/70 px-2.5 py-2">
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="w-[92px] text-sm text-muted">สั่งตั้งแต่</span>
        <div className={cn(box(qtyError), "w-[130px]")}>
          <label htmlFor={`${id}-qty`} className="sr-only">
            จำนวนขั้นต่ำ
          </label>
          <input
            id={`${id}-qty`}
            type="number"
            inputMode="numeric"
            value={minQty}
            onChange={(e) => onQty(e.target.value)}
            aria-invalid={qtyError ? true : undefined}
            aria-describedby={qtyError ? `${id}-qty-error` : undefined}
            className="h-[38px] min-w-0 flex-auto bg-transparent font-medium outline-none"
          />
          <span className="text-[13px] text-muted">ชิ้น</span>
        </div>
        <span className="text-sm text-muted">ราคา</span>
        <div className={cn(box(priceError), "w-[120px]")}>
          <span className="text-muted">฿</span>
          <label htmlFor={`${id}-price`} className="sr-only">
            ราคาต่อชิ้น
          </label>
          <input
            id={`${id}-price`}
            type="number"
            inputMode="decimal"
            value={price}
            onChange={(e) => onPrice(e.target.value)}
            aria-invalid={priceError ? true : undefined}
            aria-describedby={priceError ? `${id}-price-error` : undefined}
            className="h-[38px] min-w-0 flex-auto bg-transparent font-medium outline-none"
          />
        </div>
        {Number.isFinite(margin) && <span className="text-[13px] text-muted">กำไร {formatBaht(margin)}/ชิ้น</span>}
        <span className="flex-auto" />
        <button
          type="button"
          aria-label="ลบขั้นนี้"
          onClick={onRemove}
          className="flex size-10 items-center justify-center rounded-full text-muted hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <X aria-hidden="true" size={18} />
        </button>
      </div>
      {qtyError && (
        <span id={`${id}-qty-error`} className="pl-[102px] text-xs text-warn-ink">
          {qtyError}
        </span>
      )}
      {priceError && (
        <span id={`${id}-price-error`} className="pl-[102px] text-xs text-warn-ink">
          {priceError}
        </span>
      )}
    </li>
  );
}

function GiftRow({ gift, on, onToggle }: { gift: GiftInfo; on: boolean; onToggle: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-white/70 px-3.5 py-3">
      <Thumb size="size-10 rounded-xl" />
      <div className="flex min-w-0 flex-[1_1_200px] flex-col">
        <span className="text-sm font-semibold">ของแถม: {gift.name}</span>
        <span className="text-xs text-muted">
          ทุน {formatBaht(gift.unitCost)} · ลูกค้ารู้สึกว่าคุ้ม {formatBaht(gift.perceivedValue)} · เหลือ {formatQty(gift.qtyAvailable)} ชิ้น
        </span>
      </div>
      <button
        type="button"
        aria-pressed={on}
        aria-label={`ใช้${gift.name} เป็นของแถม`}
        onClick={onToggle}
        className="flex h-11 w-[52px] items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <Switch on={on} />
      </button>
    </div>
  );
}

function EscalationValue({ value, onChange, error }: { value: string; onChange: (v: string) => void; error?: string }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-2.5">
        <label htmlFor={id} className="text-sm">
          ดีลมูลค่าเกิน
        </label>
        <div
          className={cn(
            "flex h-11 w-[170px] items-center gap-1.5 rounded-[14px] px-3.5 focus-within:outline-2 focus-within:outline-offset-1 focus-within:outline-accent",
            error ? "border-[1.5px] border-warn bg-warn-bg" : "border border-line bg-white/85",
          )}
        >
          <span className="text-muted">฿</span>
          <input
            id={id}
            type="text"
            inputMode="numeric"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${id}-error` : undefined}
            className="h-10 min-w-0 flex-auto bg-transparent font-medium outline-none"
          />
        </div>
      </div>
      {error && (
        <span id={`${id}-error`} className="text-xs text-warn-ink">
          {error}
        </span>
      )}
    </div>
  );
}
