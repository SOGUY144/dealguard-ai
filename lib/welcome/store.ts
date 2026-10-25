// คัตซีนต้อนรับหลังล็อกอิน — ฟอร์มล็อกอินสั่งเล่น ตัวคัตซีน (อยู่ใน root layout) ฟังอยู่
// ต้องอยู่ใน root layout เพราะคัตซีนต้องค้างอยู่ตอนเปลี่ยนหน้าไปหน้าปลายทาง แล้วค่อยจางให้เห็นหน้าใหม่

export type Welcome = {
  /** หน้าที่จะพาไปหลังจบ (ผ่าน safeNextPath แล้วเสมอ) */
  to: string;
  name: string;
  role: "owner" | "buyer";
};

type Listener = () => void;

let current: Welcome | null = null;
const listeners = new Set<Listener>();

function emit() {
  for (const l of listeners) l();
}

export const welcomeStore = {
  play(welcome: Welcome) {
    current = welcome;
    emit();
  },
  finish() {
    current = null;
    emit();
  },
  get(): Welcome | null {
    return current;
  },
  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};
