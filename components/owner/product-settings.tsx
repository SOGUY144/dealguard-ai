"use client";

// หน้าตั้งค่าสินค้า (Owner-Settings.dc.html) — เถ้าแก่ตั้งราคา/ขั้นราคา/เงื่อนไขแลกส่วนลด แล้ว Deal Engine ใช้ตัวเลขนี้ทุกดีล
// + เพิ่ม/ลบสินค้าและของแถม, รูปสินค้า, นำเข้าจาก Excel (ปุ่มตามดีไซน์ ส่วนหน้าต่างไม่มีในไฟล์ดีไซน์)
// ข้อความแจ้งข้อผิด / "บันทึกแล้ว" / หมายเหตุเงื่อนไขส่งเถ้าแก่ ไม่มีในไฟล์ดีไซน์ แต่งเพิ่ม ต้องให้ทีมตรวจ
import { Check, FileSpreadsheet, Lock, Plus, Trash2, TriangleAlert, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useMemo, useState } from "react";
import { ProductThumb } from "@/components/ui/product-thumb";
import { buttonClass } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { formatBaht, formatQty } from "@/lib/format";
import type { GiftForm, ImageResult, ImportResult, NewProduct } from "@/lib/owner/catalog-rules";
import {
  MAX_TIERS,
  validateSettings,
  type FieldErrors,
  type GiftInfo,
  type ProductSettingsForm,
  type ProductSettingsPage,
  type SaveResult,
} from "@/lib/owner/product-settings";
import { AddItemDialog } from "./add-item-dialog";
import { GiftPanel } from "./gift-panel";
import { ImagePicker } from "./image-picker";
import { ImportDialog } from "./import-dialog";
import { Divider, Field, Hidden, Modal, StatusLine, Switch, type Status } from "./settings-ui";

export type CatalogActions = {
  save: (form: ProductSettingsForm) => Promise<SaveResult>;
  addProduct: (p: NewProduct) => Promise<SaveResult>;
  saveGift: (g: GiftForm, own?: string) => Promise<SaveResult>;
  deleteItem: (kind: "product" | "gift", sku: string) => Promise<SaveResult>;
  uploadImage: (form: FormData) => Promise<ImageResult>;
  deleteImage: (kind: "product" | "gift", sku: string) => Promise<SaveResult>;
  importCatalog: (items: { line: number; product: NewProduct }[]) => Promise<ImportResult>;
};

type Props = {
  page: ProductSettingsPage;
  actions: CatalogActions;
  /** test ใส่ตัวย่อรูป / ตัวอ่าน Excel ปลอมได้ */
  shrink?: (file: File) => Promise<Blob>;
  readXlsx?: (file: File) => Promise<unknown[][]>;
};
type SavedProduct = ProductSettingsPage["products"][number];
type Selection = { kind: "product" | "gift"; sku: string };
type Dialog = null | "add" | "import" | { delete: Selection & { name: string } };

export function ProductSettings({ page, actions, shrink, readXlsx }: Props) {
  const router = useRouter();
  const [picked, setPicked] = useState<Selection | null>(() =>
    page.products[0] ? { kind: "product", sku: page.products[0].sku } : page.gifts[0] ? { kind: "gift", sku: page.gifts[0].sku } : null,
  );
  const [dialog, setDialog] = useState<Dialog>(null);
  const [notice, setNotice] = useState<Status>({ kind: "idle" });

  // ของที่เลือกถูกลบไปแล้ว (แท็บอื่น / เพิ่งลบ) → เลือกอันแรกแทน
  const product = picked?.kind === "product" ? page.products.find((p) => p.sku === picked.sku) : undefined;
  const gift = picked?.kind === "gift" ? page.gifts.find((g) => g.sku === picked.sku) : undefined;
  const fallback: Selection | null = page.products[0]
    ? { kind: "product", sku: page.products[0].sku }
    : page.gifts[0]
      ? { kind: "gift", sku: page.gifts[0].sku }
      : null;
  const shownProduct = product ?? (!gift && fallback?.kind === "product" ? page.products[0] : undefined);
  const shownGift = gift ?? (!product && !shownProduct && fallback?.kind === "gift" ? page.gifts[0] : undefined);

  const takenSkus = [...page.products.map((p) => p.sku), ...page.gifts.map((g) => g.sku)];
  const refresh = () => router.refresh();

  async function confirmDelete(target: Selection & { name: string }) {
    setNotice({ kind: "saving" });
    try {
      const result = await actions.deleteItem(target.kind, target.sku);
      if (!result.ok) {
        setNotice({ kind: "error", message: result.errors.form ?? "ลบไม่สำเร็จ ลองใหม่อีกครั้ง" });
        return;
      }
      setDialog(null);
      setPicked(null);
      setNotice({ kind: "saved", message: `ลบ${target.name}แล้ว` });
      refresh();
    } catch {
      setNotice({ kind: "error", message: "ลบไม่สำเร็จ ลองใหม่อีกครั้ง" });
    }
  }

  return (
    <div className="flex flex-col gap-[22px]">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col">
          <h1 className="text-2xl leading-[1.35] font-semibold md:text-[28px]">สินค้าและราคา</h1>
          <span className="text-sm text-muted">ตั้งครั้งเดียว AI ใช้ตัวเลขนี้ทุกดีล และแก้ตัวเลขเองไม่ได้</span>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <button type="button" onClick={() => setDialog("import")} className={buttonClass("secondary", "h-[46px] px-[18px] text-sm font-medium")}>
            <FileSpreadsheet aria-hidden="true" size={17} />
            นำเข้าจาก Excel
          </button>
          <button type="button" onClick={() => setDialog("add")} className={buttonClass("primary", "h-[46px] px-5 text-sm font-semibold")}>
            <Plus aria-hidden="true" size={17} />
            เพิ่มสินค้า
          </button>
        </div>
      </header>
      {notice.kind !== "idle" && !dialog && <StatusLine status={notice} />}

      <div className="flex flex-wrap items-start gap-[22px]">
        <ProductList
          products={page.products}
          gifts={page.gifts}
          current={shownProduct ? { kind: "product", sku: shownProduct.sku } : shownGift ? { kind: "gift", sku: shownGift.sku } : null}
          onChoose={(s) => {
            setPicked(s);
            setNotice({ kind: "idle" });
          }}
        />
        {shownProduct ? (
          <ProductPanel
            key={shownProduct.sku}
            saved={shownProduct}
            gifts={page.gifts}
            actions={actions}
            onSaved={refresh}
            onDelete={() => setDialog({ delete: { kind: "product", sku: shownProduct.sku, name: shownProduct.name } })}
            shrink={shrink}
          />
        ) : shownGift ? (
          <GiftPanel
            key={shownGift.sku}
            gift={shownGift}
            actions={actions}
            onSaved={refresh}
            onDelete={() => setDialog({ delete: { kind: "gift", sku: shownGift.sku, name: shownGift.name } })}
            shrink={shrink}
          />
        ) : (
          <section className="glass flex min-w-0 flex-[999_1_520px] flex-col items-start gap-3 rounded-[26px] p-6">
            <h2 className="text-lg font-semibold">ยังไม่มีสินค้าในร้าน</h2>
            <p className="text-sm text-muted">กด &ldquo;เพิ่มสินค้า&rdquo; หรือ &ldquo;นำเข้าจาก Excel&rdquo; เพื่อเริ่มขาย</p>
          </section>
        )}
      </div>

      {dialog === "add" && (
        <AddItemDialog
          takenSkus={takenSkus}
          addProduct={actions.addProduct}
          addGift={(g) => actions.saveGift(g)}
          onAdded={(kind, sku) => {
            setDialog(null);
            setPicked({ kind, sku });
            setNotice({ kind: "saved", message: "เพิ่มแล้ว ตั้งราคาตามจำนวนและใส่รูปต่อได้เลย" });
            refresh();
          }}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === "import" && (
        <ImportDialog
          existing={page.products.map((p) => ({ sku: p.sku, tiers: p.tiers }))}
          giftSkus={page.gifts.map((g) => g.sku)}
          current={page.products.map((p) => ({
            sku: p.sku,
            name: p.name,
            listPrice: p.listPrice,
            unitCost: p.unitCost,
            floorPrice: p.floorPrice,
            cashDiscountPct: p.cashDiscountPct,
            defaultCreditDays: p.defaultCreditDays,
          }))}
          importCatalog={actions.importCatalog}
          onImported={refresh}
          onClose={() => setDialog(null)}
          readXlsx={readXlsx}
        />
      )}
      {dialog && typeof dialog === "object" && (
        <Modal title={`ลบ${dialog.delete.name}?`} onClose={() => setDialog(null)}>
          <p className="text-sm text-muted">
            {dialog.delete.kind === "product"
              ? "ลูกค้าจะไม่เห็นสินค้านี้อีก ข้อเสนอเก่าของสินค้านี้ยืนยันไม่ได้ ออเดอร์ที่ปิดไปแล้วยังอยู่ครบ ลบแล้วกู้คืนไม่ได้"
              : "AI จะไม่ใช้ของชิ้นนี้เป็นของแถมอีก ออเดอร์ที่ปิดไปแล้วยังอยู่ครบ ลบแล้วกู้คืนไม่ได้"}
          </p>
          <div className="flex flex-wrap justify-end gap-3">
            <button type="button" onClick={() => setDialog(null)} className={buttonClass("secondary", "h-12 px-5 font-medium")}>
              ยกเลิก
            </button>
            <button
              type="button"
              onClick={() => void confirmDelete(dialog.delete)}
              disabled={notice.kind === "saving"}
              className={buttonClass("white", "h-12 px-6 font-semibold text-warn-ink")}
            >
              <Trash2 aria-hidden="true" size={16} />
              ลบเลย
            </button>
          </div>
          <StatusLine status={notice} className="text-right" />
        </Modal>
      )}
    </div>
  );
}

// ───────────────────────── รายการด้านซ้าย ─────────────────────────

function ProductList({
  products,
  gifts,
  current,
  onChoose,
}: {
  products: SavedProduct[];
  gifts: GiftInfo[];
  current: Selection | null;
  onChoose: (s: Selection) => void;
}) {
  const item = (s: Selection, name: string, detail: string, imageUrl?: string) => {
    const active = current?.kind === s.kind && current.sku === s.sku;
    return (
      <button
        key={`${s.kind}:${s.sku}`}
        type="button"
        aria-current={active ? "true" : undefined}
        onClick={() => onChoose(s)}
        className={cn(
          "flex items-center gap-3 rounded-[18px] p-2.5 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
          active ? "bg-accent-tint/85 shadow-[0_0_0_2px_var(--accent)]" : "hover:bg-white/60",
        )}
      >
        <ProductThumb src={imageUrl} className="size-12 rounded-[14px]" />
        <span className="flex min-w-0 flex-auto flex-col">
          <span className="text-sm leading-[1.4] font-semibold">{name}</span>
          <span className="text-xs text-muted">{detail}</span>
        </span>
      </button>
    );
  };
  return (
    <section aria-label="รายการสินค้า" className="glass flex min-w-0 flex-[1_1_260px] flex-col gap-1.5 rounded-3xl p-2.5 md:max-w-[320px]">
      {products.map((p) =>
        item(
          { kind: "product", sku: p.sku },
          p.name,
          `${formatBaht(p.listPrice)} · พื้น ${formatBaht(p.floorPrice)}${p.aiEnabled ? "" : " · AI ไม่ต่อราคา"}`,
          p.imageUrl,
        ),
      )}
      {gifts.map((g) =>
        item(
          { kind: "gift", sku: g.sku },
          g.name,
          `${g.enabled ? "ใช้เป็นของแถม" : "ไม่ใช้เป็นของแถม"} · เหลือ ${formatQty(g.qtyAvailable)} ชิ้น`,
          g.imageUrl,
        ),
      )}
      {products.length + gifts.length === 0 && <p className="p-3 text-sm text-muted">ยังไม่มีสินค้า</p>}
    </section>
  );
}

// ───────────────────────── ตั้งค่าสินค้าหนึ่งตัว ─────────────────────────

/** ค่าในช่องกรอกเป็นตัวอักษร (ลบจนว่างได้) — แปลงเป็นตัวเลขตอนตรวจ/บันทึก */
type Draft = {
  name: string;
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
    name: p.name,
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
    name: d.name,
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

function ProductPanel({
  saved,
  gifts,
  actions,
  onSaved,
  onDelete,
  shrink,
}: {
  saved: SavedProduct;
  gifts: GiftInfo[];
  actions: CatalogActions;
  onSaved: () => void;
  onDelete: () => void;
  shrink?: (file: File) => Promise<Blob>;
}) {
  const [draft, setDraft] = useState<Draft>(() => toDraft(saved));
  const [serverErrors, setServerErrors] = useState<FieldErrors>({});
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const form = useMemo(() => toForm(saved.sku, draft), [draft, saved.sku]);
  const errors = useMemo(() => ({ ...serverErrors, ...validateSettings(form) }), [form, serverErrors]);

  const edit = (patch: Partial<Draft>) => {
    setDraft((d) => ({ ...d, ...patch }));
    setServerErrors({});
    if (status.kind !== "saving") setStatus({ kind: "idle" });
  };
  const editTier = (key: number, patch: Partial<Draft["tiers"][number]>) =>
    edit({ tiers: draft.tiers.map((t) => (t.key === key ? { ...t, ...patch } : t)) });

  async function onSave() {
    if (Object.keys(validateSettings(form)).length > 0) {
      setStatus({ kind: "error", message: "ยังบันทึกไม่ได้ แก้ช่องที่ขึ้นสีส้มก่อน" });
      return;
    }
    setStatus({ kind: "saving" });
    try {
      const result = await actions.save(form);
      if (result.ok) {
        setStatus({ kind: "saved", message: "บันทึกแล้ว แชตลูกค้าใช้ราคาใหม่ตั้งแต่ข้อความถัดไป" });
        onSaved();
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
    <section
      aria-label={`ตั้งค่า${saved.name}`}
      className="glass flex min-w-0 flex-[999_1_520px] flex-col gap-6 rounded-[26px] px-4 py-5 md:px-6 md:py-[22px]"
    >
      <div className="flex flex-wrap items-center gap-3.5">
        <ProductThumb src={saved.imageUrl} className="size-14 rounded-2xl" />
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
        <h3 className="text-base font-semibold">สินค้า</h3>
        <Field label="ชื่อสินค้า" type="text" maxLength={80} value={draft.name} onChange={(v) => edit({ name: v })} error={errors.name} />
        <ImagePicker
          kind="product"
          sku={saved.sku}
          name={saved.name}
          imageUrl={saved.imageUrl}
          upload={actions.uploadImage}
          remove={actions.deleteImage}
          onChanged={onSaved}
          shrink={shrink}
        />
      </div>

      <Divider />

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
        {draft.tiers.length === 0 && <p className="text-sm text-muted">ยังไม่มีขั้นราคา AI จะไม่เสนอข้อ &ldquo;ซื้อเยอะ&rdquo;</p>}
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
        {gifts.map((g) => (
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
        <button type="button" onClick={onDelete} className={buttonClass("ghost", "h-11 px-3 text-sm text-warn-ink")}>
          <Trash2 aria-hidden="true" size={16} />
          ลบสินค้านี้
        </button>
        <span className="flex-[1_1_200px] text-[13px] text-muted">บันทึกแล้วมีผลกับแชตลูกค้าทันที</span>
        <button
          type="button"
          onClick={() => {
            setDraft(toDraft(saved));
            setServerErrors({});
            setStatus({ kind: "idle" });
          }}
          disabled={status.kind === "saving"}
          className={buttonClass("secondary", "h-12 px-5 font-medium")}
        >
          ยกเลิก
        </button>
        <button
          type="button"
          onClick={() => void onSave()}
          aria-busy={status.kind === "saving"}
          disabled={status.kind === "saving"}
          className={buttonClass("primary", "h-12 px-7 font-semibold")}
        >
          บันทึก
        </button>
      </div>
      <StatusLine status={status} className="-mt-3 text-right" />
    </section>
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
      <ProductThumb src={gift.imageUrl} className="size-10 rounded-xl" />
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
