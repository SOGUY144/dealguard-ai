import merchant from "@/lib/config/merchant.json";
import type { Intent, MerchantConfig, NegotiationState, Product } from "../types";

export const config: MerchantConfig = merchant;
export const cable: Product = config.products[0];

export const freshState: NegotiationState = { belowFloorCount: 0, injectionCount: 0 };

/** Intent ตั้งต้นของตัวอย่างใน SKILL: "ขอ 125 ได้ไหม 1000 ชิ้น" */
export function intentOf(overrides: Partial<Intent> = {}): Intent {
  return {
    intent: "negotiate_price",
    sku: "CBL-C-1M",
    requestedPrice: 125,
    quantity: 1000,
    paymentTermsRequestedDays: null,
    competitorClaim: null,
    buyerName: "คุณนก",
    injectionSuspected: false,
    ...overrides,
  };
}
