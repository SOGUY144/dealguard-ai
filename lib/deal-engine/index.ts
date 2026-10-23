// Deal Engine ใช้ต้นทุนและราคาพื้น — ห้ามถูก bundle ไปฝั่ง browser
import "server-only";

export { runDealEngine } from "./engine";
export { UnsafeOfferError } from "./guard";
export type * from "./types";
