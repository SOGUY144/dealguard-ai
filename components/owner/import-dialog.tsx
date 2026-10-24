"use client";

// นำเข้าสินค้าจาก Excel (.xlsx) หรือ CSV — อ่านไฟล์ในเครื่อง แสดงตัวอย่าง + ข้อผิดทีละแถวก่อนกดนำเข้า
// server ตรวจซ้ำทุกแถว แล้วบันทึกทั้งไฟล์ในคำสั่งเดียว (แถวไหนผิด ไม่บันทึกเลยสักแถว)
import { Download, FileSpreadsheet, LoaderCircle } from "lucide-react";
import { useRef, useState } from "react";
import { buttonClass } from "@/components/ui/button";
import { formatBaht } from "@/lib/format";
import {
  importTemplateCsv,
  parseCsv,
  parseImportSheet,
  type ExistingProduct,
  type ImportResult,
  type ImportRow,
  type NewProduct,
} from "@/lib/owner/catalog-rules";
import { Modal, StatusLine, type Status } from "./settings-ui";

type Props = {
  existing: ExistingProduct[];
  giftSkus: string[];
  /** สินค้าปัจจุบัน — ใส่ในไฟล์ตัวอย่าง */
  current: NewProduct[];
  importCatalog: (items: { line: number; product: NewProduct }[]) => Promise<ImportResult>;
  onImported: () => void;
  onClose: () => void;
  /** test ใส่ตัวอ่าน .xlsx ปลอมได้ */
  readXlsx?: (file: File) => Promise<unknown[][]>;
};

async function readXlsxFile(file: File): Promise<unknown[][]> {
  // โหลดตัวอ่าน Excel เฉพาะตอนใช้ — หน้าอื่นไม่ต้องโหลด
  const { readSheet } = await import("read-excel-file/browser");
  return readSheet(file);
}

const FIELD_LABEL: Record<string, string> = {
  sku: "รหัส",
  name: "ชื่อ",
  listPrice: "ราคาขาย",
  unitCost: "ต้นทุน",
  floorPrice: "ราคาพื้น",
  cashDiscountPct: "ลดจ่ายสด",
  defaultCreditDays: "เครดิต",
};

export function ImportDialog({ existing, giftSkus, current, importCatalog, onImported, onClose, readXlsx = readXlsxFile }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<ImportRow[] | null>(null);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [reading, setReading] = useState(false);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setFileName(file.name);
    setRows(null);
    setStatus({ kind: "idle" });
    setReading(true);
    try {
      const isCsv = /\.csv$/i.test(file.name) || file.type === "text/csv";
      const sheet = isCsv ? parseCsv(await file.text()) : await readXlsx(file);
      const parsed = parseImportSheet(sheet, existing, giftSkus);
      if (!parsed.ok) {
        setStatus({ kind: "error", message: parsed.error });
        return;
      }
      setRows(parsed.rows);
    } catch {
      setStatus({ kind: "error", message: "อ่านไฟล์ไม่ได้ ใช้ไฟล์ .xlsx หรือ .csv ตามไฟล์ตัวอย่าง" });
    } finally {
      setReading(false);
      if (input.current) input.current.value = "";
    }
  }

  function downloadTemplate() {
    const blob = new Blob([importTemplateCsv(current)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "dealguard-สินค้า.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const bad = rows?.filter((r) => Object.keys(r.errors).length > 0) ?? [];

  async function onImport() {
    if (!rows || bad.length > 0) return;
    setStatus({ kind: "saving" });
    try {
      const result = await importCatalog(rows.map(({ line, product }) => ({ line, product })));
      if (result.ok) {
        setStatus({ kind: "saved", message: `นำเข้าแล้ว ${result.count} รายการ` });
        onImported();
        return;
      }
      if ("rowErrors" in result) {
        const byLine = new Map(result.rowErrors.map((r) => [r.line, r.errors]));
        setRows(rows.map((r) => ({ ...r, errors: byLine.get(r.line) ?? r.errors })));
        setStatus({ kind: "error", message: "มีแถวที่ยังผิด แก้ในไฟล์แล้วเลือกไฟล์ใหม่" });
        return;
      }
      setStatus({ kind: "error", message: result.error });
    } catch {
      setStatus({ kind: "error", message: "นำเข้าไม่สำเร็จ ลองใหม่อีกครั้ง" });
    }
  }

  return (
    <Modal title="นำเข้าจาก Excel" onClose={onClose} wide>
      <p className="text-sm text-muted">
        ใช้ไฟล์ .xlsx หรือ .csv แถวแรกเป็นหัวตาราง: รหัสสินค้า, ชื่อสินค้า, ราคาขาย, ต้นทุน, ราคาพื้น, ลดจ่ายสด (%), เครดิต (วัน) ·
        รหัสใหม่ = เพิ่มสินค้า · รหัสเดิม = แก้ราคา (ขั้นราคาตามจำนวนเดิมยังอยู่)
      </p>
      <div className="flex flex-wrap gap-2.5">
        <input
          ref={input}
          type="file"
          accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="sr-only"
          aria-label="เลือกไฟล์สินค้า"
          tabIndex={-1}
          onChange={(e) => void onFile(e.target.files?.[0])}
        />
        <button type="button" onClick={() => input.current?.click()} disabled={reading} className={buttonClass("primary", "h-11 px-5 text-sm font-semibold")}>
          {reading ? <LoaderCircle aria-hidden="true" size={16} className="motion-safe:animate-spin" /> : <FileSpreadsheet aria-hidden="true" size={16} />}
          เลือกไฟล์
        </button>
        <button type="button" onClick={downloadTemplate} className={buttonClass("secondary", "h-11 px-5 text-sm font-medium")}>
          <Download aria-hidden="true" size={16} />
          ดาวน์โหลดไฟล์ตัวอย่าง
        </button>
        {fileName && <span className="self-center text-sm text-muted">{fileName}</span>}
      </div>

      {rows && (
        <div className="overflow-x-auto rounded-2xl bg-white/70">
          <table className="w-full min-w-[640px] text-left text-sm">
            <caption className="sr-only">สินค้าในไฟล์</caption>
            <thead className="text-xs text-muted">
              <tr>
                <th className="px-3 py-2 font-medium">แถว</th>
                <th className="px-3 py-2 font-medium">สินค้า</th>
                <th className="px-3 py-2 font-medium">ขาย / ทุน / พื้น</th>
                <th className="px-3 py-2 font-medium">จ่ายสด / เครดิต</th>
                <th className="px-3 py-2 font-medium">ผล</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const errs = Object.entries(r.errors);
                return (
                  <tr key={r.line} className="border-t border-line-soft align-top">
                    <td className="px-3 py-2 text-muted">{r.line}</td>
                    <td className="px-3 py-2">
                      <span className="block font-medium">{r.product.name || "—"}</span>
                      <span className="text-xs text-muted">{r.product.sku || "—"}</span>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {[r.product.listPrice, r.product.unitCost, r.product.floorPrice]
                        .map((n) => (Number.isFinite(n) ? formatBaht(n) : "—"))
                        .join(" / ")}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {Number.isFinite(r.product.cashDiscountPct) ? `${r.product.cashDiscountPct}%` : "—"} /{" "}
                      {Number.isFinite(r.product.defaultCreditDays) ? `${r.product.defaultCreditDays} วัน` : "—"}
                    </td>
                    <td className="px-3 py-2">
                      {errs.length > 0 ? (
                        <ul className="flex flex-col gap-0.5 text-xs text-warn-ink">
                          {errs.map(([field, message]) => (
                            <li key={field}>
                              {FIELD_LABEL[field] ?? field}: {message}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <span className="text-xs font-medium text-ok-ink">{r.action === "create" ? "เพิ่มใหม่" : "แก้ราคา"}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-end gap-3">
        {rows && bad.length > 0 && <span className="flex-auto text-sm text-warn-ink">ผิด {bad.length} แถว แก้ในไฟล์แล้วเลือกไฟล์ใหม่</span>}
        <button type="button" onClick={onClose} className={buttonClass("secondary", "h-12 px-5 font-medium")}>
          ปิด
        </button>
        <button
          type="button"
          onClick={() => void onImport()}
          disabled={!rows || bad.length > 0 || status.kind === "saving" || status.kind === "saved"}
          aria-busy={status.kind === "saving"}
          className={buttonClass("primary", "h-12 px-7 font-semibold")}
        >
          {rows ? `นำเข้า ${rows.length} รายการ` : "นำเข้า"}
        </button>
      </div>
      <StatusLine status={status} className="text-right" />
    </Modal>
  );
}
