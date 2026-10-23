// กฎว่าหน้าไหนต้องล็อกอิน — ใช้ใน proxy.ts (เช็กเบื้องต้นเท่านั้น role ตรวจซ้ำใน lib/auth/dal.ts)

/** เข้าได้โดยไม่ต้องล็อกอิน */
const PUBLIC_PATHS = ["/login", "/signup", "/forgot-password", "/auth/callback", "/privacy"];
/** ล็อกอินแล้วไม่ต้องเห็นอีก */
const GUEST_ONLY = ["/login", "/signup", "/forgot-password"];

const matches = (pathname: string, paths: string[]) =>
  paths.some((p) => pathname === p || pathname.startsWith(`${p}/`));

export type AccessDecision = "allow" | { redirect: string };

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

/** รับ ?next= ได้เฉพาะ path ภายในเว็บ — กันลิงก์ล่อให้ล็อกอินแล้วเด้งไปเว็บอื่น */
export function safeNextPath(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return "/";
  if (matches(next.split(/[?#]/)[0], GUEST_ONLY)) return "/";
  return next;
}
