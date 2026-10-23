import { describe, expect, it } from "vitest";
import { decideAccess, isSameOrigin, landingPath, safeNextPath } from "../routes";

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
    for (const pathname of ["/login", "/signup", "/forgot-password", "/auth/callback", "/privacy"]) {
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

  it("ไม่พากลับไปหน้าล็อกอินซ้ำ", () => {
    expect(safeNextPath("/login")).toBe("/");
  });
});
