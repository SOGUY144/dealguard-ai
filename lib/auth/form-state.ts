/** ผลของ server action ฟอร์ม auth (ใช้กับ useActionState) */
export type FormState = {
  /** error รวมของฟอร์ม เช่น รหัสผ่านไม่ถูก */
  error?: string;
  /** error ข้างช่องที่ผิด */
  fieldErrors?: Partial<Record<string, string>>;
  /** ข้อความแจ้งผลที่ไม่ใช่ error เช่น ส่งอีเมลแล้ว */
  notice?: string;
  /** ค่าที่กรอกไว้ ให้ไม่ต้องพิมพ์ใหม่ (ไม่เก็บรหัสผ่าน) */
  values?: Partial<Record<string, string>>;
};

export type FormAction = (prev: FormState, form: FormData) => Promise<FormState>;
