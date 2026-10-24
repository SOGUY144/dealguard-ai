// Types ของ Deal Engine (Layer 2) — ไฟล์นี้มีแต่ type จึง import จากฝั่ง client ได้ (เช่น Offer)
// แต่ตัวเลขต้นทุน/ราคาพื้นต้องไม่ถูกส่งไป browser: ใช้ Offer (public) เท่านั้นนอก server

export type VolumeTier = { minQty: number; price: number };

export type Product = {
  sku: string;
  name: string;
  listPrice: number;
  unitCost: number;
  floorPrice: number;
  volumeTiers: VolumeTier[];
  cashDiscountPct: number;
  defaultCreditDays: number;
  /** รูปใน Storage (ไม่ใช้คิดราคา) */
  imagePath?: string | null;
};

export type DeadStock = {
  sku: string;
  name: string;
  unitCost: number;
  perceivedValue: number;
  qtyAvailable: number;
};

/** คำตอบที่เถ้าแก่กรอกไว้ให้ลูกค้า (ว่าง = ยังไม่กรอก ผู้ช่วยจะไม่ตอบเรื่องนั้น) — ไม่ใช้คิดราคา */
export type ShopAnswers = { delivery: string; stock: string };

export type MerchantConfig = {
  merchantName: string;
  ownerDisplayName: string;
  costOfCapitalAnnual: number;
  escalationDealValue: number;
  /** ข้อ C: ลดจากราคาขายเป็นสัดส่วนของส่วนที่ลูกค้าขอลด (0.2 = 20%) */
  bundleConcessionRatio: number;
  products: Product[];
  deadStock: DeadStock[];
  answers: ShopAnswers;
};

/** Output ของ Layer 1 (SKILL §6.3) ในรูป camelCase — ค่าที่ดึงไม่ได้เป็น null */
export type Intent = {
  intent: "negotiate_price" | "ask_info" | "order" | "complaint" | "refund" | "other";
  sku: string | null;
  requestedPrice: number | null;
  quantity: number | null;
  paymentTermsRequestedDays: number | null;
  competitorClaim: { mentioned: boolean; price: number | null } | null;
  buyerName: string | null;
  injectionSuspected: boolean;
  /** งบรวมที่ลูกค้าบอก ("320 บาทได้กี่เส้น") — ใส่เฉพาะเมื่อมี */
  budgetTotal?: number | null;
  /** ลูกค้าหงุดหงิด/บ่นว่าตอบไม่ดี — ใส่เฉพาะเมื่อใช่ */
  frustrated?: boolean;
};

/** ข้อเสนอที่ส่งให้ลูกค้าเห็นได้ (HANDOFF §5) — ไม่มีต้นทุนหรือ margin */
export type Offer = {
  id: "A" | "B" | "C";
  lever: "volume" | "cash" | "bundle" | "list";
  label: string;
  pricePerUnit: number;
  qty: number;
  conditionText: string;
  total: number;
  creditDays: number;
  /** sku ใช้หักสต๊อก (ชื่อเถ้าแก่เปลี่ยนได้) · ข้อเสนอเก่าก่อน 24 ต.ค. 2569 ไม่มี sku */
  bundle?: { sku?: string; name: string; qty: number };
};

/** ตัวเลขหลังบ้านของแต่ละข้อเสนอ — แสดงได้เฉพาะหน้าเถ้าแก่ */
export type OfferEconomics = {
  marginIfConceded: number;
  marginOffer: number;
  recoveredMargin: number;
  bundleCost: number;
  cashValue: number;
};

export type PricedOffer = { offer: Offer; economics: OfferEconomics };

/** all_rejected = ลูกค้าไม่รับทุกทางเลือกแลก (เก็บในฐานข้อมูลเป็น buyer_request — ดู lib/chat/replies.ts) */
export type EscalationKind = "over_value" | "refund" | "complaint" | "below_floor_3x" | "injection" | "all_rejected";

/** ตัวนับต่อแชต ใช้ตัดสินว่าเมื่อไหร่ต้องส่งให้เถ้าแก่ */
export type NegotiationState = { belowFloorCount: number; injectionCount: number };

export type EngineInput = {
  config: MerchantConfig;
  intent: Intent;
  state: NegotiationState;
  buyerName: string;
  /** ข้อความล่าสุดของลูกค้า ใช้ใส่ใน Deal Brief */
  messageText: string;
  /** ทางเลือกที่ลูกค้าบอกว่าไม่เอาแล้ว — ไม่เสนอซ้ำ · ไม่เหลือทางเลือก → ส่งให้เถ้าแก่ตัดสิน */
  rejectedLevers?: ("volume" | "cash" | "bundle")[];
};

export type EngineResult =
  | { kind: "offers"; offers: PricedOffer[]; state: NegotiationState }
  | { kind: "accept_list"; offer: PricedOffer; state: NegotiationState }
  | { kind: "ask_quantity"; sku: string; state: NegotiationState }
  | { kind: "ask_product"; state: NegotiationState }
  | { kind: "guard"; state: NegotiationState }
  | { kind: "not_negotiation"; state: NegotiationState }
  | {
      kind: "escalate";
      reason: EscalationKind;
      brief: [string, string, string];
      state: NegotiationState;
    };
