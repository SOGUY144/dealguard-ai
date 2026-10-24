import { describe, expect, it } from "vitest";
import type { ChatMessage, Offer } from "@/lib/chat/types";
import { approvalDefaults, type ApprovalProduct } from "../chat-view";

const at = "2026-10-25T01:00:00.000Z";
const products: ApprovalProduct[] = [{ sku: "CBL-C-1M", name: "สายชาร์จ", listPrice: 150, unitCost: 100, floorPrice: 120 }];
const offer = (id: Offer["id"], lever: Offer["lever"], qty: number): Offer => ({
  id,
  lever,
  label: lever,
  pricePerUnit: 130,
  qty,
  conditionText: "",
  total: 130 * qty,
  creditDays: 0,
});
const card = (n: number, offers: Offer[]): ChatMessage => ({ id: `card-${n}`, at, type: "offers", sku: "CBL-C-1M", offers });

describe("approvalDefaults — ค่าเริ่มต้นของฟอร์มอนุมัติราคา", () => {
  it("จำนวนที่ลูกค้าขอ = จำนวนของข้อที่ไม่ใช่ 'ซื้อเยอะ'", () => {
    const messages = [card(1, [offer("A", "volume", 1500), offer("B", "cash", 1000)])];
    expect(approvalDefaults(messages, products)).toEqual({ sku: "CBL-C-1M", qty: 1000 });
  });

  it("ลูกค้าไม่เอาข้ออื่นจนการ์ดล่าสุดเหลือแค่ 'ซื้อเยอะ' → ยังได้จำนวนที่ลูกค้าขอจากการ์ดก่อนหน้า ไม่ใช่ 1,500", () => {
    const messages = [
      card(1, [offer("A", "volume", 1500), offer("B", "cash", 1000), offer("C", "bundle", 1000)]),
      card(2, [offer("A", "volume", 1500), offer("B", "cash", 1000)]),
      card(3, [offer("A", "volume", 1500)]),
    ];
    expect(approvalDefaults(messages, products)).toEqual({ sku: "CBL-C-1M", qty: 1000 });
  });

  it("ไม่มีการ์ดไหนบอกจำนวนที่ขอ (มีแต่ 'ซื้อเยอะ') → เว้นว่างให้เถ้าแก่กรอกเอง ไม่เดา", () => {
    expect(approvalDefaults([card(1, [offer("A", "volume", 1500)])], products)).toEqual({ sku: "CBL-C-1M", qty: null });
  });
});
