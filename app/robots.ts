import type { MetadataRoute } from "next";

/** ให้ค้นหาเจอเฉพาะหน้าสาธารณะ — หน้าเถ้าแก่ ใบสั่งซื้อ และ API เป็นของส่วนตัว */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/owner", "/order", "/api", "/auth"] },
  };
}
