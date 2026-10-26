import sharp, { type Sharp } from "sharp";

const MAX_WIDTH = 1600;
const WEBP_QUALITY = 78;
// Meta katalogu WebP kabul etmiyor (yalniz JPEG/PNG): her gorselin ayni boyutta
// JPEG kopyasi da yazilir, /feed/meta.xml onu kullanir (bkz. META_KATALOG_PLANI.md).
const JPEG_QUALITY = 85;

// JPEG saydamlik tasimaz: saydam alan (PNG/WebP) siyah degil beyaz zemine oturur.
export function toJpeg(image: Sharp): Sharp {
  return image.flatten({ background: "#ffffff" }).jpeg({ quality: JPEG_QUALITY });
}

/**
 * Urun gorsellerini Blob'a yazmadan once tek tip hale getirir: genislik 1600px'i
 * asiyorsa oranli kucultur (kucukse buyutmez), WebP'e cevirir (kalite ~78).
 * Boylece hem yeni yuklemelerin hem Koton'dan cekilen gorsellerin Blob'daki boyutu
 * orijinaline gore %10-20'ye iner. Ayni cozulmus gorselden JPEG kopyasi da uretilir.
 */
export async function compressImage(
  buffer: Buffer
): Promise<{ buffer: Buffer; contentType: string; ext: string; jpeg: Buffer }> {
  const resized = sharp(buffer).rotate().resize({ width: MAX_WIDTH, withoutEnlargement: true });
  const [output, jpeg] = await Promise.all([
    resized.clone().webp({ quality: WEBP_QUALITY }).toBuffer(),
    toJpeg(resized.clone()).toBuffer()
  ]);
  return { buffer: output, contentType: "image/webp", ext: "webp", jpeg };
}
