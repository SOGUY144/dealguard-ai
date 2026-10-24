import { describe, expect, it } from "vitest";
import { canSetNewPassword, clientIp, decideAccess, isSameOrigin, landingPath, safeNextPath, sessionResetAction } from "../routes";

describe("decideAccess (proxy — เช็กเบื้องต้น ก่อนเข้าแต่ละหน้า)", () => {
  it("ยังไม่ล็อกอิน เข้าหน้าแชต → ไปล็อกอิน แล้วจำหน้าที่จะกลับมา", () => {
    expect(decideAccess({ pathname: "/", search: "?state=offers", signedIn: false })).toEqual({
      redirect: "/login?next=%2F%3Fstate%3Doffers",
    });
  });

  it("ยังไม่ล็อกอิน เข้าหน้าเถ้าแก่หรือออเดอร์ → ไปล็อกอิน", () => {
    expect(decideAccess({ pathname: "/owner", search: "", signedIn: false })).toEqual({
      redirect: "/login?next=%2Fowner",
    });
    expect(decideAccess({ pathname: "/order/demo-A", search: "", signedIn: false })).toMatchObject({
      redirect: expect.stringMatching(/^\/login\?next=/),
    });
  });

  it("หน้าสาธารณะเข้าได้โดยไม่ต้องล็อกอิน", () => {
    for (const pathname of ["/login", "/signup", "/forgot-password", "/auth/callback", "/privacy", "/how-to-order", "/contact"]) {
      expect(decideAccess({ pathname, search: "", signedIn: false })).toBe("allow");
    }
  });

  it("ล็อกอินแล้วเปิดหน้าล็อกอิน/สมัคร → กลับหน้าแรก", () => {
    expect(decideAccess({ pathname: "/login", search: "", signedIn: true })).toEqual({ redirect: "/" });
    expect(decideAccess({ pathname: "/signup", search: "", signedIn: true })).toEqual({ redirect: "/" });
  });

  it("ล็อกอินแล้วเข้าหน้าอื่นได้ (ตรวจ role ซ้ำใน Data Access Layer)", () => {
    expect(decideAccess({ pathname: "/owner", search: "", signedIn: true })).toBe("allow");
    expect(decideAccess({ pathname: "/privacy", search: "", signedIn: true })).toBe("allow");
  });

  it("ล้าง session ของบัญชีที่ถูกลบได้โดยไม่ต้องล็อกอิน (กันวน / ↔ /login)", () => {
    expect(decideAccess({ pathname: "/auth/session-reset", search: "?next=%2F", signedIn: false })).toBe("allow");
    expect(decideAccess({ pathname: "/auth/session-reset", search: "", signedIn: true })).toBe("allow");
  });

  it("API ที่ยังไม่ล็อกอิน → ตอบ 401 (ไม่ redirect ไปหน้า HTML)", () => {
    expect(decideAccess({ pathname: "/api/chat", search: "", signedIn: false })).toBe("unauthorized");
    expect(decideAccess({ pathname: "/api/chat", search: "", signedIn: true })).toBe("allow");
  });

  it("ตั้งรหัสผ่านใหม่ต้องมี session (ได้มาจากลิงก์ในอีเมล)", () => {
    expect(decideAccess({ pathname: "/reset-password", search: "", signedIn: false })).toMatchObject({
      redirect: expect.stringMatching(/^\/login/),
    });
    expect(decideAccess({ pathname: "/reset-password", search: "", signedIn: true })).toBe("allow");
  });
});

describe("landingPath (หลังล็อกอินไปไหน)", () => {
  it("เถ้าแก่ที่ไม่ได้ระบุหน้า → หน้าเถ้าแก่", () => {
    expect(landingPath("owner", "/")).toBe("/owner");
  });

  it("ลูกค้า → หน้าแชต", () => {
    expect(landingPath("buyer", "/")).toBe("/");
  });

  it("ระบุหน้าไว้ (เช่นเปิดลิงก์ออเดอร์) → ไปหน้านั้น", () => {
    expect(landingPath("owner", "/order/demo-A")).toBe("/order/demo-A");
    expect(landingPath("buyer", "/?state=offers")).toBe("/?state=offers");
  });
});

describe("isSameOrigin (กันเว็บอื่นยิงคำขอแทนผู้ใช้)", () => {
  it("origin ตรงกับเว็บเรา → ผ่าน", () => {
    expect(isSameOrigin("http://localhost:3000", "http://localhost:3000")).toBe(true);
  });

  it("ไม่มี origin หรือมาจากเว็บอื่น → ไม่ผ่าน", () => {
    expect(isSameOrigin(null, "http://localhost:3000")).toBe(false);
    expect(isSameOrigin("https://evil.example", "http://localhost:3000")).toBe(false);
  });
});

describe("safeNextPath (กัน open redirect)", () => {
  it("รับเฉพาะ path ภายในเว็บ", () => {
    expect(safeNextPath("/owner")).toBe("/owner");
    expect(safeNextPath("/?state=offers")).toBe("/?state=offers");
  });

  it("ลิงก์ไปเว็บอื่นหรือค่าแปลกๆ → หน้าแรก", () => {
    for (const bad of ["https://evil.example", "//evil.example", "/\\evil.example", "javascript:alert(1)", "", null, undefined]) {
      expect(safeNextPath(bad)).toBe("/");
    }
  });

  it("ตัวอักษรควบคุม (tab / ขึ้นบรรทัด) ที่ browser ตัดทิ้งแล้วกลายเป็น //evil → หน้าแรก", () => {
    // พบจากการรีวิว: new URL("/\t/evil.example", origin) กลายเป็น https://evil.example/
    for (const bad of ["/\t/evil.example", "/\n/evil.example", "/\r\n/evil.example", "/\u0000/x"]) {
      expect(safeNextPath(bad)).toBe("/");
    }
  });

  it("path ปกติที่มี query และ hash ยังใช้ได้", () => {
    expect(safeNextPath("/order/demo-A?x=1#top")).toBe("/order/demo-A?x=1#top");
  });

  it("ไม่พากลับไปหน้าล็อกอินซ้ำ", () => {
    expect(safeNextPath("/login")).toBe("/");
  });
});

describe("sessionResetAction (บัญชีถูกลบแต่ session ยังไม่หมดอายุ)", () => {
  it("ไม่มีบัญชีแล้วจริง → ออกจากระบบ", () => {
    expect(sessionResetAction({ signedIn: true, profile: "missing" })).toBe("sign_out");
  });

  it("ยังมีบัญชี → ไม่ออกจากระบบ กลับหน้าเดิม", () => {
    expect(sessionResetAction({ signedIn: true, profile: "found" })).toBe("continue");
  });

  it("อ่านฐานข้อมูลไม่ได้ → ห้ามออกจากระบบ ให้ลองใหม่", () => {
    expect(sessionResetAction({ signedIn: true, profile: "error" })).toBe("retry_later");
  });

  it("ไม่มี session → ไปหน้าล็อกอิน", () => {
    expect(sessionResetAction({ signedIn: false, profile: "missing" })).toBe("login");
  });
});

describe("canSetNewPassword (ตั้งรหัสใหม่ได้เฉพาะคนที่เพิ่งเปิดลิงก์จากอีเมล)", () => {
  const now = 1_800_000_000;
  it("เพิ่งเข้าด้วยลิงก์ตั้งรหัสผ่าน (recovery) ไม่เกิน 15 นาที → ได้", () => {
    expect(canSetNewPassword([{ method: "recovery", timestamp: now - 60 }], now)).toBe(true);
  });
  it("ล็อกอินด้วยรหัสผ่านธรรมดา → ไม่ได้ (คนที่ยืมเครื่อง/ขโมย session มาเปลี่ยนรหัสยึดบัญชีไม่ได้)", () => {
    expect(canSetNewPassword([{ method: "password", timestamp: now - 60 }], now)).toBe(false);
  });
  it("ลิงก์เก่าเกิน 15 นาที → ไม่ได้", () => {
    expect(canSetNewPassword([{ method: "recovery", timestamp: now - 16 * 60 }], now)).toBe(false);
  });
  // วัดจริงกับ Supabase 24 ต.ค. 2569: ลิงก์ตั้งรหัสผ่านให้ amr = "otp" (ไม่ใช่ "recovery")
  it("เพิ่งเข้าด้วยลิงก์จากอีเมล (amr = otp) → ได้", () => {
    expect(canSetNewPassword([{ method: "otp", timestamp: now - 60 }], now)).toBe(true);
  });

  it("ไม่มีข้อมูล amr → ไม่ได้", () => {
    expect(canSetNewPassword(undefined, now)).toBe(false);
  });
});

describe("clientIp (ใช้นับจำนวนครั้งที่ลอง)", () => {
  it("เอาตัวแรกของ x-forwarded-for (ที่ proxy ของ Vercel ใส่)", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }))).toBe("203.0.113.7");
  });
  it("ไม่มี header → unknown", () => {
    expect(clientIp(new Headers())).toBe("unknown");
  });
});

