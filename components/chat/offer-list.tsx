"use client";

import { useId } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import type { Offer } from "@/lib/chat/types";
import { formatBaht } from "@/lib/format";

type Props = {
  offers: Offer[];
  ownerName: string;
  selectedId?: Offer["id"];
  confirmed?: boolean;
  onSelect: (id: Offer["id"]) => void;
  onConfirm: () => void;
};

/** ข้อเสนอ A/B/C จาก Deal Engine — UI แสดงตัวเลขตามที่ได้รับเท่านั้น ไม่คำนวณเอง (HANDOFF §6) */
export function OfferList({ offers, ownerName, selectedId, confirmed, onSelect, onConfirm }: Props) {
  const headingId = useId();
  const selected = offers.find((o) => o.id === selectedId);

  return (
    <div className="flex flex-col gap-1.5 rounded-[18px] border border-line-soft bg-white p-2.5 md:gap-2 md:p-3">
      <span id={headingId} className="px-0.5 text-[13px] font-semibold md:text-sm">
        {offers.length} ทางเลือกจาก{ownerName}
      </span>
      <div role="group" aria-labelledby={headingId} className="flex flex-col gap-1.5 md:gap-2">
        {offers.map((offer) => (
          <OfferCard
            key={offer.id}
            offer={offer}
            selected={offer.id === selectedId}
            locked={!!confirmed}
            onClick={() => onSelect(offer.id)}
          />
        ))}
      </div>
      {selected && !confirmed && (
        <Button variant="primary" className="h-[46px] text-sm" onClick={onConfirm}>
          ยืนยันข้อ {selected.id} · {formatBaht(selected.total)}
        </Button>
      )}
    </div>
  );
}

function OfferCard({
  offer,
  selected,
  locked,
  onClick,
}: {
  offer: Offer;
  selected: boolean;
  locked: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={locked}
      onClick={onClick}
      className={cn(
        "grid w-full grid-cols-[30px_1fr_auto] items-center gap-x-2.5 rounded-[14px] border-2 px-2.5 py-2 text-left",
        "transition-colors duration-150 md:grid-cols-[34px_1fr_auto] md:gap-x-3 md:px-3 md:py-2.5",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        "disabled:cursor-default",
        selected ? "border-accent bg-accent-tint2" : "border-line-soft bg-accent-surface",
        !selected && locked && "opacity-60",
      )}
    >
      <span
        className={cn(
          "row-span-2 grid size-[30px] place-items-center rounded-full text-[13px] font-bold md:size-[34px] md:text-base",
          selected ? "bg-accent text-white" : "bg-accent-tint text-accent-ink",
        )}
      >
        {offer.id}
      </span>
      <span className="text-sm font-semibold md:text-base">{offer.label}</span>
      <span className="text-right text-[17px] font-bold md:text-[19px]">
        {formatBaht(offer.pricePerUnit)}
        <span className="text-xs font-medium text-muted">/ชิ้น</span>
      </span>
      <span className="text-xs text-muted md:text-[13px]">{offer.conditionText}</span>
      <span className="text-right text-[11px] text-muted md:text-xs">
        <span className="hidden md:inline">รวม </span>
        {formatBaht(offer.total)}
      </span>
    </button>
  );
}
