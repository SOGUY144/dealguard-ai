// กฎเพิ่มสินค้า / ของแถม / นำเข้าจาก Excel-CSV — ใช้ทั้งในหน้าจอ (บอกข้อผิดก่อนกด) และ server (บังคับจริง)
// ข้อความแจ้งข้อผิดไม่มีในไฟล์ดีไซน์ แต่งเพิ่ม ต้องให้ทีมตรวจ
import { formatBaht } from "@/lib/format";
import { validateSettings, type FieldErrors } from "./product-settings";

export type NewProduct = {
  sku: string;
  name: string;
  listPrice: number;
  unitCost: number;
  floorPrice: number;
  /** % (5 = 5%) */
  cashDiscountPct: number;
  defaultCreditDays: number;
};

export type GiftForm = {
  sku: string;
  name: string;
  unitCost: number;
  perceivedValue: number;
  qtyAvailable: number;
  enabled: boolean;
};

const SKU = /^[A-Za-z0-9][A-Za-z0-9_-]{1,31}$/;
const MAX_NAME = 80;
const SKU_MESSAGE = "ใช้ตัวอังกฤษ ตัวเลข - หรือ _ 2–32 ตัว";

function checkIdentity(sku: string, name: string, taken: string[], own?: string): FieldErrors {
  const errors: FieldErrors = {};
  if (!SKU.test(sku)) errors.sku = SKU_MESSAGE;
  else if (sku !== own && taken.includes(sku)) errors.sku = "รหัสนี้มีอยู่แล้ว";
  const trimmed = name.trim();
  if (!trimmed || trimmed.length > MAX_NAME) errors.name = `ใส่ชื่อสินค้า (ไม่เกิน ${MAX_NAME} ตัวอักษร)`;
  return errors;
}

const PRICE_FIELDS = ["listPrice", "unitCost", "floorPrice", "cashDiscountPct", "defaultCreditDays"] as const;

/** taken = รหัสสินค้าและของแถมที่มีอยู่แล้ว (รหัสห้ามซ้ำกันทั้งร้าน) */
export function validateNewProduct(p: NewProduct, taken: string[]): FieldErrors {
  // กฎราคาเดียวกับหน้าตั้งค่า — ใส่ค่าร้านที่ถูกต้องไว้ แล้วเลือกเฉพาะช่องของสินค้า
  const priceErrors = validateSettings({
    ...p,
    tiers: [],
    aiEnabled: true,
    costOfCapitalPct: 0,
    escalationDealValue: 1,
    gifts: [],
  });
  const errors = checkIdentity(p.sku, p.name, taken);
  for (const key of PRICE_FIELDS) if (priceErrors[key]) errors[key] = priceErrors[key];
  return errors;
}

/** own = รหัสเดิมของของแถมที่กำลังแก้ (ไม่นับว่าซ้ำกับตัวเอง) */
export function validateGift(g: GiftForm, taken: string[], own?: string): FieldErrors {
  const errors = checkIdentity(g.sku, g.name, taken, own);
  if (!Number.isFinite(g.unitCost) || g.unitCost < 0) errors.unitCost = "ใส่ต้นทุนตั้งแต่ 0";
  if (!Number.isFinite(g.perceivedValue) || g.perceivedValue < 0) errors.perceivedValue = "ใส่มูลค่าตั้งแต่ 0";
  if (!Number.isInteger(g.qtyAvailable) || g.qtyAvailable < 0) errors.qtyAvailable = "ใส่จำนวนเต็มตั้งแต่ 0";
  return errors;
}

// ───────────────────────── นำเข้าจาก Excel / CSV ─────────────────────────

/** อ่าน CSV (รองรับ "ช่องที่มี , หรือ "" ข้างใน") · ตัด BOM · ข้ามบรรทัดว่าง */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const src = text.replace(/^﻿/, "");
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(cell);
      if (row.some((c) => c !== "")) rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c !== "")) rows.push(row);
  return rows;
}

type Column = keyof NewProduct;
const COLUMNS: { key: Column; label: string; aliases: string[]; required: boolean }[] = [
  { key: "sku", label: "รหัสสินค้า", aliases: ["sku", "รหัสสินค้า", "รหัส"], required: true },
  { key: "name", label: "ชื่อสินค้า", aliases: ["name", "ชื่อสินค้า", "ชื่อ"], required: true },
  { key: "listPrice", label: "ราคาขาย", aliases: ["list_price", "listprice", "ราคาขาย"], required: true },
  { key: "unitCost", label: "ต้นทุน", aliases: ["unit_cost", "unitcost", "ต้นทุน"], required: true },
  { key: "floorPrice", label: "ราคาพื้น", aliases: ["floor_price", "floorprice", "ราคาพื้น"], required: true },
  { key: "cashDiscountPct", label: "ลดจ่ายสด (%)", aliases: ["cash_discount_pct", "ลดจ่ายสด"], required: false },
  { key: "defaultCreditDays", label: "เครดิต (วัน)", aliases: ["credit_days", "เครดิต"], required: false },
];
const DEFAULTS = { cashDiscountPct: 0, defaultCreditDays: 30 };

/** "ลดจ่ายสด (%)" → "ลดจ่ายสด" · "List Price" → "listprice" */
const normalizeHeader = (v: unknown) =>
  String(v ?? "")
    .toLowerCase()
    .replace(/\(.*?\)/g, "")
    .replace(/\s+/g, "");

const isBlank = (v: unknown) => v === null || v === undefined || String(v).trim() === "";
const toNumber = (v: unknown) => (typeof v === "number" ? v : isBlank(v) ? Number.NaN : Number(String(v).replace(/[,฿\s]/g, "")));

export type ImageResult = { ok: true; imageUrl: string } | { ok: false; error: string };
export type ImportResult =
  | { ok: true; count: number }
  | { ok: false; rowErrors: { line: number; errors: FieldErrors }[] }
  | { ok: false; error: string };

export type ImportRow = { line: number; action: "create" | "update"; product: NewProduct; errors: FieldErrors };
export type ImportParse = { ok: true; rows: ImportRow[] } | { ok: false; error: string };
export type ExistingProduct = { sku: string; tiers: { minQty: number; price: number }[] };

/** rows = แถวจาก Excel/CSV (แถวแรกเป็นหัวตาราง) · existing = สินค้าในร้าน · giftSkus = รหัสของแถม (ห้ามใช้ซ้ำ) */
export function parseImportSheet(rows: unknown[][], existing: ExistingProduct[], giftSkus: string[] = []): ImportParse {
  if (rows.length === 0) return { ok: false, error: "ไฟล์ไม่มีข้อมูล" };
  const header = rows[0].map(normalizeHeader);
  const index = new Map<Column, number>();
  for (const col of COLUMNS) {
    const at = header.findIndex((h) => col.aliases.some((a) => normalizeHeader(a) === h));
    if (at >= 0) index.set(col.key, at);
  }
  const missing = COLUMNS.filter((c) => c.required && !index.has(c.key)).map((c) => c.label);
  if (missing.length > 0) return { ok: false, error: `ไม่พบคอลัมน์: ${missing.join(", ")}` };

  const items: { line: number; product: NewProduct }[] = [];
  rows.slice(1).forEach((cells, i) => {
    if (cells.every(isBlank)) return;
    const cell = (key: Column) => {
      const at = index.get(key);
      return at === undefined ? undefined : cells[at];
    };
    const optional = (key: "cashDiscountPct" | "defaultCreditDays") => (isBlank(cell(key)) ? DEFAULTS[key] : toNumber(cell(key)));
    items.push({
      line: i + 2,
      product: {
        sku: String(cell("sku") ?? "").trim(),
        name: String(cell("name") ?? "").trim(),
        listPrice: toNumber(cell("listPrice")),
        unitCost: toNumber(cell("unitCost")),
        floorPrice: toNumber(cell("floorPrice")),
        cashDiscountPct: optional("cashDiscountPct"),
        defaultCreditDays: optional("defaultCreditDays"),
      },
    });
  });
  const parsed = reviewImport(items, existing, giftSkus);
  if (parsed.length === 0) return { ok: false, error: "ไฟล์ไม่มีข้อมูลสินค้า" };
  return { ok: true, rows: parsed };
}

/** ตรวจทีละแถว (ใช้ทั้งตอนอ่านไฟล์และที่ server ก่อนบันทึก) — รหัสซ้ำในไฟล์, ชนของแถม, ขั้นราคาเดิมกับพื้นใหม่ */
export function reviewImport(
  items: { line: number; product: NewProduct }[],
  existing: ExistingProduct[],
  giftSkus: string[],
): ImportRow[] {
  const bySku = new Map(existing.map((p) => [p.sku, p]));
  const seen = new Set<string>();
  return items.map(({ line, product }) => {
    const errors = validateNewProduct(product, giftSkus);
    if (errors.sku === "รหัสนี้มีอยู่แล้ว") errors.sku = "รหัสนี้เป็นของแถมอยู่แล้ว";
    if (!errors.sku && seen.has(product.sku)) errors.sku = "รหัสซ้ำกับแถวอื่นในไฟล์";
    seen.add(product.sku);

    const current = bySku.get(product.sku);
    if (current && !errors.floorPrice && !errors.listPrice) {
      // ขั้นราคาเดิมยังอยู่ — ต้องไม่ต่ำกว่าพื้นใหม่ / ไม่เกินราคาขายใหม่ (ฐานข้อมูลก็บังคับ)
      const below = current.tiers.filter((t) => t.price < product.floorPrice).map((t) => t.price);
      const above = current.tiers.filter((t) => t.price > product.listPrice).map((t) => t.price);
      if (below.length) errors.floorPrice = `ขั้นราคาเดิม (${formatBaht(Math.min(...below))}) ต่ำกว่าราคาพื้นใหม่ แก้ขั้นในหน้าสินค้าก่อน`;
      else if (above.length) errors.listPrice = `ขั้นราคาเดิม (${formatBaht(Math.max(...above))}) สูงกว่าราคาขายใหม่ แก้ขั้นในหน้าสินค้าก่อน`;
    }
    return { line, action: current ? "update" : "create", product, errors };
  });
}

/** ไฟล์ตัวอย่างให้เถ้าแก่ดาวน์โหลด — หัวตารางภาษาไทย + สินค้าปัจจุบัน (มี BOM ให้ Excel อ่านภาษาไทยถูก) */
export function importTemplateCsv(products: NewProduct[]): string {
  const esc = (v: string | number) => {
    const s = String(v);
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [
    COLUMNS.map((c) => c.label),
    ...products.map((p) => COLUMNS.map((c) => p[c.key])),
  ].map((cells) => cells.map(esc).join(","));
  return `﻿${lines.join("\r\n")}\r\n`;
}
