import { describe, expect, it } from "vitest";
import { authErrorMessage, parseLogin, parseSignup } from "../forms";

function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [k, v] of Object.entries(values)) data.set(k, v);
  return data;
}

describe("parseSignup", () => {
  const valid = { display_name: "คุณนก", email: "nok@example.com", password: "a-strong-pass", privacy: "on" };

  it("ข้อมูลครบ → ผ่าน", () => {
    expect(parseSignup(form(valid))).toEqual({
      ok: true,
      data: { displayName: "คุณนก", email: "nok@example.com", password: "a-strong-pass" },
    });
  });

  it("ตัดช่องว่างหัวท้าย และอีเมลเป็นตัวเล็ก", () => {
    const result = parseSignup(form({ ...valid, display_name: "  คุณนก ", email: " Nok@Example.com " }));
    expect(result.ok && result.data).toMatchObject({ displayName: "คุณนก", email: "nok@example.com" });
  });

  it("บอก error ทีละช่อง ข้างช่องที่ผิด", () => {
    const result = parseSignup(form({ display_name: "", email: "nope", password: "short" }));
    expect(result).toEqual({
      ok: false,
      fieldErrors: {
        display_name: "กรอกชื่อที่ให้ร้านเรียก",
        email: "อีเมลไม่ถูกต้อง",
        password: "รหัสผ่านอย่างน้อย 8 ตัวอักษร",
        privacy: "ต้องยอมรับนโยบายความเป็นส่วนตัวก่อนสมัคร",
      },
    });
  });
});

describe("parseLogin", () => {
  it("ต้องมีอีเมลกับรหัสผ่าน", () => {
    expect(parseLogin(form({ email: "nok@example.com", password: "x" }))).toEqual({
      ok: true,
      data: { email: "nok@example.com", password: "x" },
    });
    expect(parseLogin(form({ email: "", password: "" }))).toMatchObject({
      ok: false,
      fieldErrors: { email: "อีเมลไม่ถูกต้อง", password: "กรอกรหัสผ่าน" },
    });
  });
});

describe("authErrorMessage", () => {
  it("แปล error ที่เจอบ่อยเป็นภาษาไทย", () => {
    expect(authErrorMessage({ code: "invalid_credentials" })).toBe("อีเมลหรือรหัสผ่านไม่ถูกต้อง");
    expect(authErrorMessage({ code: "email_not_confirmed" })).toBe("ยังไม่ได้ยืนยันอีเมล — เปิดลิงก์ในอีเมลที่ส่งไปก่อนนะครับ");
    expect(authErrorMessage({ code: "user_already_exists" })).toBe("อีเมลนี้สมัครไว้แล้ว ลองเข้าสู่ระบบแทน");
    expect(authErrorMessage({ code: "over_email_send_rate_limit" })).toBe("ส่งอีเมลบ่อยเกินไป รอสักครู่แล้วลองใหม่");
    expect(authErrorMessage({ code: "weak_password" })).toBe("รหัสผ่านง่ายเกินไป ลองตั้งให้ยาวขึ้น");
    // อีเมลฟรีของ Supabase ส่งได้เฉพาะอีเมลในทีม (กระทบ "ลืมรหัสผ่าน" ของลูกค้าทั่วไป)
    expect(authErrorMessage({ code: "email_address_not_authorized" })).toBe(
      "ตอนนี้ระบบยังส่งอีเมลไปที่อีเมลนี้ไม่ได้ ติดต่อร้านเพื่อขอความช่วยเหลือ",
    );
    expect(authErrorMessage({ code: "email_address_invalid" })).toBe("อีเมลนี้รับอีเมลไม่ได้ ตรวจสอบอีเมลอีกครั้ง");
  });

  it("error ที่ไม่รู้จัก → ข้อความกลาง ไม่โชว์รายละเอียดระบบ", () => {
    expect(authErrorMessage({ code: "something_new", message: "db exploded at row 42" })).toBe(
      "มีบางอย่างผิดพลาด ลองใหม่อีกครั้ง",
    );
    expect(authErrorMessage(null)).toBe("มีบางอย่างผิดพลาด ลองใหม่อีกครั้ง");
  });
});
