import { LayoutGrid, Mic } from "lucide-react";
import type { ReactNode } from "react";
import { ProductThumb } from "@/components/ui/product-thumb";
import { cn } from "@/lib/cn";
import { formatBaht } from "@/lib/format";

const TEXT = "text-sm leading-[1.55] md:text-[15px] md:leading-[1.6]";

export function AiBubble({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("bubble-ai px-3 py-2.5 md:px-3.5 md:py-3", TEXT, className)}>{children}</div>;
}

/** ข้อความแรกของแชตมีปุ่ม "ดูสินค้าทั้งหมด" อยู่ในฟอง (Main.dc.html) */
export function AiBubbleWithProductsCta({ text, onOpenProducts }: { text: string; onOpenProducts: () => void }) {
  return (
    <AiBubble className="flex flex-col items-start gap-2.5">
      <span>{text}</span>
      <button
        type="button"
        onClick={onOpenProducts}
        className="flex h-10 items-center gap-2 rounded-full border-[1.5px] border-accent-border bg-accent-surface px-4 text-sm font-semibold text-accent-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <LayoutGrid aria-hidden="true" size={16} />
        ดูสินค้าทั้งหมด
      </button>
    </AiBubble>
  );
}

export function BuyerBubble({ text, viaVoice }: { text: string; viaVoice: boolean }) {
  return (
    <div className={cn("bubble-buyer max-w-[82%] md:max-w-[78%] md:px-3.5 md:py-3", TEXT)}>
      {viaVoice && (
        <span className="mr-1.5 inline-flex translate-y-0.5 text-accent-ink">
          <Mic aria-hidden="true" size={14} />
          <span className="sr-only">ส่งด้วยเสียง</span>
        </span>
      )}
      {text}
    </div>
  );
}

/** การ์ดสินค้าที่ลูกค้าเลือก ส่งเข้าแชตฝั่งลูกค้า */
export function ProductCardMessage({
  sku,
  name,
  listPrice,
  imageUrl,
}: {
  sku: string;
  name: string;
  listPrice: number;
  imageUrl?: string;
}) {
  return (
    <article
      aria-label={name}
      className="flex w-[250px] max-w-[80%] items-center gap-2.5 rounded-[18px_6px_18px_18px] bg-accent-tint p-2 md:w-[320px] md:gap-3 md:p-2.5"
    >
      <ProductThumb src={imageUrl} className="size-12 rounded-xl md:size-14 md:rounded-[14px]" />
      <span className="flex min-w-0 flex-col">
        <span className="hidden text-xs text-muted md:block">{sku}</span>
        <span className="text-sm font-semibold leading-[1.4] md:text-[15px]">{name}</span>
        <span className="text-[13px] md:text-sm">
          {formatBaht(listPrice)} <span className="text-muted">/ ชิ้น</span>
        </span>
      </span>
    </article>
  );
}
