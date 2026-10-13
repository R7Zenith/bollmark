// Tarayicida, yuklemeden once gorseli kucultur. Vercel fonksiyonlarinin istek
// govdesi siniri ~4.5 MB oldugu icin telefon fotograflari aksi halde 413 aliyor.
// Uzun kenar MAX_EDGE'i asiyorsa (ya da dosya sinirdan buyukse) canvas ile
// kucultulup JPEG'e cevrilir; sunucudaki sharp sikistirmasi aynen devam eder.

export const MAX_UPLOAD_BYTES = 4.5 * 1024 * 1024;
const MAX_EDGE = 2000;

// Admin gorsel yuklemede kabul edilen formatlar - istemci (dosya secimi/filtre) ve
// sunucu (/api/admin/upload) ayni listeyi kullanir. Cikti her zaman WebP'dir
// (bkz. image-compress.ts); AVIF sadece girdi olarak kabul edilir.
export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];
const ACCEPTED_IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".avif"];
export const ACCEPTED_IMAGE_ACCEPT_ATTR = [...ACCEPTED_IMAGE_TYPES, ...ACCEPTED_IMAGE_EXTENSIONS].join(",");

// Tarayici bazen (ozellikle Windows'ta .avif icin) file.type'i bos verir; o zaman uzantiya bakilir.
export function isAcceptedImage(file: { type: string; name: string }): boolean {
  if (file.type) return ACCEPTED_IMAGE_TYPES.includes(file.type);
  const name = file.name.toLowerCase();
  return ACCEPTED_IMAGE_EXTENSIONS.some((ext) => name.endsWith(ext));
}

export async function resizeImageForUpload(file: File): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const longEdge = Math.max(bitmap.width, bitmap.height);
    if (longEdge <= MAX_EDGE && file.size <= MAX_UPLOAD_BYTES) {
      bitmap.close();
      return file;
    }

    const scale = Math.min(1, MAX_EDGE / longEdge);
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return file;
    }
    // Seffaf PNG'ler JPEG'de siyah zemine donmesin.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
    if (!blob) return file;
    const name = file.name.replace(/\.[^./\\]+$/, "") + ".jpg";
    return new File([blob], name, { type: "image/jpeg" });
  } catch {
    return file;
  }
}
