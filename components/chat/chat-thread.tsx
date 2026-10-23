"use client";

import { groupMessages, type MessageRow } from "@/lib/chat/group";
import type { ChatMessage, Offer, Storefront } from "@/lib/chat/types";
import { cn } from "@/lib/cn";
import { formatClock } from "@/lib/format";
import { AiAvatar } from "@/components/ui/ai-avatar";
import { buttonClass } from "@/components/ui/button";
import { AiBubble, AiBubbleWithProductsCta, BuyerBubble, ProductCardMessage } from "./bubbles";
import { HandoffCard } from "./handoff-card";
import { OfferList } from "./offer-list";
import { OrderSummaryCard } from "./order-summary-card";
import { SystemNotice } from "./system-notice";
import { VoiceBubble } from "./voice-bubble";

export type ThreadHandlers = {
  onSelectOffer: (messageId: string, offerId: Offer["id"]) => void;
  onConfirmOffer: (messageId: string) => void;
  onOpenProducts: () => void;
  onShowOffers: () => void;
};

type Props = ThreadHandlers & {
  messages: ChatMessage[];
  storefront: Storefront;
  buyerName: string;
};

/** element id ของข้อความ — ใช้เลื่อนกลับไปหาข้อเสนอ */
export const messageElementId = (id: string) => `msg-${id}`;

// ข้อความ AI ที่ต้องกว้างกว่าฟองปกติ (เสียง, ข้อเสนอ, ใบสรุป, การ์ดส่งเรื่อง)
const WIDE = new Set<ChatMessage["type"]>(["ai_voice", "offers", "order_summary", "handoff"]);

export function ChatThread({ messages, storefront, buyerName, ...handlers }: Props) {
  const rows = groupMessages(messages);
  const lastOffers = [...messages].reverse().find((m) => m.type === "offers");

  return (
    <div
      role="log"
      aria-live="polite"
      aria-label="ข้อความในแชต"
      className="mx-auto flex w-full max-w-[760px] flex-col gap-3 px-3.5 pt-3.5 pb-2 md:gap-[18px] md:px-6 md:pt-5 md:pb-3"
    >
      {messages[0] && (
        <span className="self-center rounded-full border border-[#EFEAF8] bg-white/90 px-3 py-1 text-xs text-muted md:px-3.5 md:py-[5px]">
          วันนี้ · {formatClock(messages[0].at)}
        </span>
      )}
      {rows.map((row) => (
        <Row
          key={row.id}
          row={row}
          storefront={storefront}
          buyerName={buyerName}
          offersShown={lastOffers?.type === "offers" ? lastOffers.offers.length : 3}
          {...handlers}
        />
      ))}
    </div>
  );
}

type RowProps = ThreadHandlers & {
  row: MessageRow;
  storefront: Storefront;
  buyerName: string;
  offersShown: number;
};

function Row({ row, storefront, buyerName, offersShown, ...handlers }: RowProps) {
  const first = row.messages[0];

  if (row.kind === "notice") {
    return first.type === "system" ? <SystemNotice kind={first.kind} /> : null;
  }

  if (row.kind === "buyer") {
    return (
      <div className="flex flex-col items-end gap-1.5">
        <span className="hidden text-[13px] text-muted md:inline">
          {formatClock(first.at)} · <span className="font-semibold text-ink">{buyerName} (คุณ)</span>
        </span>
        {first.type === "product_card" ? (
          <ProductCardMessage sku={first.sku} name={first.name} listPrice={first.listPrice} />
        ) : first.type === "buyer_text" ? (
          <BuyerBubble text={first.text} viaVoice={first.inputMode === "voice"} />
        ) : null}
      </div>
    );
  }

  const wide = row.messages.some((m) => WIDE.has(m.type));
  return (
    <div className="flex items-start gap-2 md:gap-2.5">
      <AiAvatar variant="message" />
      <div
        className={cn(
          "flex min-w-0 flex-col gap-2",
          wide ? "flex-1 md:w-[460px] md:max-w-[82%] md:flex-none" : "max-w-[86%] md:max-w-[78%]",
        )}
      >
        <span className="hidden text-[13px] text-muted md:inline">
          <span className="font-semibold text-ink">{storefront.assistantName}</span> · {formatClock(first.at)}
        </span>
        {row.messages.map((m) => (
          <AiItem key={m.id} message={m} storefront={storefront} offersShown={offersShown} {...handlers} />
        ))}
      </div>
    </div>
  );
}

function AiItem({
  message: m,
  storefront,
  offersShown,
  onSelectOffer,
  onConfirmOffer,
  onOpenProducts,
  onShowOffers,
}: ThreadHandlers & { message: ChatMessage; storefront: Storefront; offersShown: number }) {
  switch (m.type) {
    case "ai_text":
      if (m.cta === "open_products") return <AiBubbleWithProductsCta text={m.text} onOpenProducts={onOpenProducts} />;
      return (
        <>
          <AiBubble>{m.text}</AiBubble>
          {m.cta === "show_offers" && (
            <button
              type="button"
              onClick={onShowOffers}
              className={buttonClass("secondary", "h-10 min-h-0 self-start px-3.5 text-[13px] font-semibold")}
            >
              ดูข้อเสนอ {offersShown} ทางอีกครั้ง
            </button>
          )}
        </>
      );
    case "ai_voice":
      // ข้อความเสียงต้องมี transcript ตามมาเสมอ (HANDOFF §2)
      return (
        <>
          <VoiceBubble durationSec={m.durationSec} audioUrl={m.audioUrl} />
          <AiBubble>{m.transcript}</AiBubble>
        </>
      );
    case "offers":
      return (
        <div id={messageElementId(m.id)} className="scroll-mt-4">
          <OfferList
            offers={m.offers}
            ownerName={storefront.ownerName}
            selectedId={m.selectedId}
            confirmed={m.confirmed}
            onSelect={(offerId) => onSelectOffer(m.id, offerId)}
            onConfirm={() => onConfirmOffer(m.id)}
          />
        </div>
      );
    case "order_summary":
      return (
        <OrderSummaryCard
          orderId={m.orderId}
          offer={m.offer}
          productName={m.productName}
          bankAccountName={storefront.bankAccountName}
        />
      );
    case "handoff":
      return (
        <HandoffCard
          ownerName={storefront.ownerName}
          subject={m.subject}
          orderRef={m.orderRef}
          contactChannel={storefront.contactChannel}
        />
      );
    case "system":
      return <SystemNotice kind={m.kind} />;
    default:
      return null;
  }
}
