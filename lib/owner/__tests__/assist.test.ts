import { describe, expect, it, vi } from "vitest";
import merchant from "@/lib/config/merchant.json";
import { fallbackIntent } from "@/lib/ai/fallback-intent";
import type { MerchantConfig } from "@/lib/deal-engine/types";

vi.mock("server-only", () => ({}));
const { buildAssist } = await import("../assist");

const config: MerchantConfig = merchant;
const products = config.products.map(({ sku, name, listPrice }) => ({ sku, name, listPrice }));
const storefront = {
  storeName: "ร้านเฮียชัยโมบาย",
  tagline: "",
  ownerName: "เฮียชัย",
  assistantName: "ผู้ช่วย AI ของเฮียชัย",
  bankAccountName: "",
  contactChannel: "",
  orderRefPlaceholder: "",
};
const assist = (text: string, buyerName = "นก") =>
  buildAssist(config, fallbackIntent(text, { products, lastSku: "CBL-C-1M" }), text, { buyerName, products, storefront });

describe("buildAssist — วางข้อความลูกค้าจาก LINE", () => {
  it("ต่อราคา → 3 ข้อเสนอ + กำไรแต่ละข้อ + ข้อความพร้อมคัดลอก (ไม่มีต้นทุนในข้อความ)", () => {
    const r = assist("ขอ 125 ได้ไหม 1000 ชิ้น");
    expect(r.offers.map((o) => o.offer.lever)).toEqual(["volume", "cash", "bundle"]);
    expect(r.offers[0].profit).toBe(45_000);
    expect(r.replyText).toContain("สวัสดีครับคุณนก");
    expect(r.replyText).toContain("A · ซื้อเยอะ ฿130/ชิ้น — เมื่อสั่ง 1,500 ชิ้น (รวม ฿195,000)");
    expect(r.replyText).toContain("สนใจข้อไหนตอบกลับมาได้เลยครับ");
    expect(r.replyText).not.toMatch(/ทุน|ราคาพื้น|กำไร/);
    expect(r.decision).toBeNull();
  });

  it("วางทั้งบทสนทนาที่ลูกค้าปฏิเสธซื้อเพิ่ม → ไม่เสนอข้อซื้อเยอะ", () => {
    const r = assist("ขอ 125 ได้ไหม 1000 ชิ้น\nไม่ซื้อเพิ่มนะ");
    expect(r.offers.map((o) => o.offer.lever)).toEqual(["cash", "bundle"]);
  });

  it("ปฏิเสธทุกทาง → ไม่มีข้อความให้ส่ง แต่บอกเถ้าแก่ว่าถ้ายอมได้กำไรเท่าไหร่", () => {
    const r = assist("ขอ 125 ได้ไหม 1000 ชิ้น ไม่เอาสักอย่าง");
    expect(r.replyText).toBe("");
    expect(r.decision?.[2]).toContain("ถ้ายอม ฿125 ได้กำไร ฿25,000");
  });

  it("ไม่บอกจำนวน → ข้อความถามจำนวน", () => {
    const r = assist("ขอลดหน่อยได้ไหม");
    expect(r.missing).toBe("quantity");
    expect(r.replyText).toContain("ต้องการกี่ชิ้น");
  });

  it("ไม่ใส่ชื่อลูกค้า → ขึ้นต้นสวัสดีครับเฉยๆ", () => {
    expect(assist("ขอ 125 ได้ไหม 1000 ชิ้น", "").replyText.startsWith("สวัสดีครับ ราคา")).toBe(true);
  });
});
