// กฎว่าหน้าไหนต้องล็อกอิน — ใช้ใน proxy.ts (เช็กเบื้องต้นเท่านั้น role ตรวจซ้ำใน lib/auth/dal.ts)

/** เข้าได้โดยไม่ต้องล็อกอิน */
const PUBLIC_PATHS = ["/login", "/signup", "/forgot-password", "/auth/callback", "/auth/session-reset", "/privacy"];
/** ล็อกอินแล้วไม่ต้องเห็นอีก */
const GUEST_ONLY = ["/login", "/signup", "/forgot-password"];

const matches = (pathname: string, paths: string[]) =>
  paths.some((p) => pathname === p || pathname.startsWith(`${p}/`));

/** unauthorized = API ตอบ 401 เป็น JSON (fetch ตาม redirect ไปหน้า HTML ไม่ได้) */
export type AccessDecision = "allow" | "unauthorized" | { redirect: string };

export function decideAccess({
  pathname,
  search,
  signedIn,
}: {
  pathname: string;
  search: string;
  signedIn: boolean;
}): AccessDecision {
  if (signedIn) return matches(pathname, GUEST_ONLY) ? { redirect: "/" } : "allow";
  if (matches(pathname, PUBLIC_PATHS)) return "allow";
  if (matches(pathname, ["/api"])) return "unauthorized";
  return { redirect: `/login?next=${encodeURIComponent(pathname + search)}` };
}

/** หลังล็อกอิน: เถ้าแก่ที่ไม่ได้ตั้งใจไปหน้าไหนเป็นพิเศษ ไปหน้าเถ้าแก่ · นอกนั้นไปหน้าที่ขอไว้ */
export function landingPath(role: "owner" | "buyer", next: string): string {
  return role === "owner" && next === "/" ? "/owner" : next;
}

/** คำขอที่เปลี่ยนสถานะ (เช่น ออกจากระบบ) ต้องมาจากหน้าเว็บของเราเอง */
export function isSameOrigin(origin: string | null, expected: string): boolean {
  return origin !== null && origin === expected;
}

const SENTINEL_ORIGIN = "http://next.invalid";

/** รับ ?next= ได้เฉพาะ path ภายในเว็บ — กันลิงก์ล่อให้ล็อกอินแล้วเด้งไปเว็บอื่น */
export function safeNextPath(next: string | null | undefined): string {
  if (!next || !next.startsWith("/")) return "/";
  // browser ตัด tab/ขึ้นบรรทัดทิ้งตอน parse URL ("/\t/evil" → "//evil") และ "\" ถือเป็น "/"
  if (/[\u0000-\u001f\u007f\\]/.test(next)) return "/";
  // ให้ URL parser ตัดสินจริง: ถ้า origin เปลี่ยน แปลว่าพาออกนอกเว็บ
  let url: URL;
  try {
    url = new URL(next, SENTINEL_ORIGIN);
  } catch {
    return "/";
  }
  if (url.origin !== SENTINEL_ORIGIN || matches(url.pathname, GUEST_ONLY)) return "/";
  return url.pathname + url.search + url.hash;
}

/**
 * /auth/session-reset: ออกจากระบบเฉพาะเมื่อแน่ใจว่าบัญชีไม่มีแล้ว
 * อ่านฐานข้อมูลไม่ได้ (เน็ตสะดุด) ห้ามออกจากระบบ — ไม่งั้นคนที่ยังมีบัญชีจะหลุดเอง
 */
export function sessionResetAction({
  signedIn,
  profile,
}: {
  signedIn: boolean;
  profile: "found" | "missing" | "error";
}): "login" | "continue" | "sign_out" | "retry_later" {
  if (!signedIn) return "login";
  if (profile === "found") return "continue";
  return profile === "missing" ? "sign_out" : "retry_later";
}
