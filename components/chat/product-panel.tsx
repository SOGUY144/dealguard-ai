"use client";

import { Search, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { buttonClass, IconButton } from "@/components/ui/button";
import type { PublicProduct } from "@/lib/chat/types";
import { cn } from "@/lib/cn";
import { formatBaht } from "@/lib/format";
import { ProductThumb } from "@/components/ui/product-thumb";

type PanelProps = {
  products: PublicProduct[];
  /** สินค้าที่กำลังต่อราคาอยู่ในแชต */
  activeSku?: string;
  onAsk: (sku: string) => void;
  onClose: () => void;
  /** รอคำตอบอยู่ — กดขอต่อราคาซ้อนไม่ได้ */
  busy?: boolean;
};

function useProductSearch(products: PublicProduct[]) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const filtered = q
    ? products.filter((p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q))
    : products;
  return { query, setQuery, filtered };
}

function SearchField({ value, onChange, className }: { value: string; onChange: (v: string) => void; className?: string }) {
  const id = useId();
  return (
    <div className={cn("flex items-center gap-2 rounded-full px-3.5", className)}>
      <label htmlFor={id} className="sr-only">
        ค้นหาสินค้า
      </label>
      <Search aria-hidden="true" size={17} className="shrink-0 text-muted" />
      <input
        id={id}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="ค้นหาสินค้า"
        className="h-10 min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted"
      />
    </div>
  );
}

const Empty = () => <p className="py-6 text-center text-sm text-muted">ไม่พบสินค้า</p>;

/** คอม: drawer ด้านขวาของแชต (Main.dc.html) */
export function ProductDrawer({ products, activeSku, onAsk, onClose, busy = false }: PanelProps) {
  const { query, setQuery, filtered } = useProductSearch(products);
  return (
    <aside
      aria-label="สินค้าในร้าน"
      className="hidden min-w-0 max-w-[380px] flex-[1_1_320px] flex-col overflow-hidden rounded-[30px] md:flex border border-white/95 bg-white/72 shadow-[0_18px_44px_rgba(110,90,170,0.12)] backdrop-blur-[16px]"
    >
      <div className="flex shrink-0 items-center gap-2.5 py-4 pr-4 pl-5">
        <h2 className="flex-1 text-[17px] font-semibold">สินค้าในร้าน</h2>
        <IconButton label="ปิดรายการสินค้า" onClick={onClose} className="size-10 shadow-[0_4px_12px_rgba(110,90,170,0.12)]">
          <X aria-hidden="true" size={16} strokeWidth={2.2} />
        </IconButton>
      </div>
      <div className="shrink-0 px-4 pb-3">
        <SearchField value={query} onChange={setQuery} className="h-11 border border-[#EFEAF8] bg-white text-sm" />
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto px-4 pb-4">
        {filtered.length === 0 && <Empty />}
        {filtered.map((p) => {
          const active = p.sku === activeSku;
          return (
            <article
              key={p.sku}
              className={cn(
                "flex flex-col gap-2.5 rounded-[20px] bg-white p-2.5",
                active ? "shadow-[0_0_0_2px_var(--accent)]" : "shadow-[0_6px_16px_rgba(110,90,170,0.08)]",
              )}
            >
              <ProductInfo product={p} />
              <button
                type="button"
                onClick={() => onAsk(p.sku)}
                disabled={busy}
                className={buttonClass(active ? "secondary" : "primary", "h-10 min-h-0 text-sm font-semibold")}
              >
                {active ? "กำลังต่อราคาในแชต" : "ขอต่อราคา"}
              </button>
            </article>
          );
        })}
      </div>
    </aside>
  );
}

/** มือถือ: bottom sheet (Mobile-Product.dc.html) */
export function ProductSheet({ products, onAsk, onClose, busy = false }: PanelProps) {
  const { query, setQuery, filtered } = useProductSearch(products);
  const headingId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);

  // เปิดแล้วโฟกัสปุ่มปิด · ปิดแล้วคืนโฟกัสให้ปุ่มที่กดเปิด
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    return () => {
      if (opener?.isConnected) opener.focus();
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 md:hidden">
      <div data-testid="sheet-backdrop" aria-hidden="true" onClick={onClose} className="absolute inset-0 bg-[rgba(43,45,62,0.35)]" />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        onKeyDown={(e) => e.key === "Escape" && onClose()}
        className="absolute inset-x-0 bottom-0 flex h-[560px] max-h-[85dvh] flex-col rounded-t-[28px] bg-white pb-[env(safe-area-inset-bottom)] shadow-[0_-16px_40px_rgba(43,45,62,0.18)] motion-safe:animate-[sheet-up_220ms_ease-out]"
      >
        <span aria-hidden="true" className="mt-2.5 h-[5px] w-11 self-center rounded-full bg-line" />
        <div className="flex items-center gap-2.5 py-2.5 pr-4 pl-5">
          <h2 id={headingId} className="flex-1 text-lg font-semibold">
            สินค้าในร้าน
          </h2>
          <IconButton ref={closeRef} label="ปิดรายการสินค้า" variant="soft" onClick={onClose}>
            <X aria-hidden="true" size={16} strokeWidth={2.2} />
          </IconButton>
        </div>
        <div className="px-4 pb-3">
          <SearchField value={query} onChange={setQuery} className="h-[46px] bg-[#F7F4FD] px-4 text-[15px]" />
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto px-4 pb-6">
          {filtered.length === 0 && <Empty />}
          {filtered.map((p) => (
            <article
              key={p.sku}
              className="flex items-center gap-3 rounded-[20px] border border-line-soft bg-accent-surface p-2.5"
            >
              <div className="min-w-0 flex-1">
                <ProductInfo product={p} />
              </div>
              <button
                type="button"
                onClick={() => onAsk(p.sku)}
                disabled={busy}
                className={buttonClass("primary", "h-11 shrink-0 px-3.5 text-[13px] font-semibold")}
              >
                ต่อราคา
              </button>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function ProductInfo({ product }: { product: PublicProduct }) {
  return (
    <div className="flex items-center gap-3">
      <ProductThumb src={product.imageUrl} className="size-16 rounded-2xl" />
      <span className="flex min-w-0 flex-col">
        <span className="text-xs text-muted">{product.sku}</span>
        <span className="text-[15px] leading-[1.4] font-semibold">{product.name}</span>
        <span className="text-sm">
          {formatBaht(product.listPrice)} <span className="text-muted">/ ชิ้น</span>
        </span>
      </span>
    </div>
  );
}
