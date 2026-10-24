// รูปสินค้าอยู่ใน Supabase Storage bucket สาธารณะ (อ่านได้ทุกคน อัปโหลดได้เฉพาะ server) — ใช้ได้ทั้ง server และ browser
export const PRODUCT_IMAGE_BUCKET = "product-images";

export function productImageUrl(path: string | null | undefined): string | undefined {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!path || !base) return undefined;
  const key = path.split("/").map(encodeURIComponent).join("/");
  return `${base.replace(/\/+$/, "")}/storage/v1/object/public/${PRODUCT_IMAGE_BUCKET}/${key}`;
}
