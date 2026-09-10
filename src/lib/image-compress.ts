import sharp from "sharp";

const MAX_WIDTH = 1600;
const WEBP_QUALITY = 78;

/**
 * Urun gorsellerini Blob'a yazmadan once tek tip hale getirir: genislik 1600px'i
 * asiyorsa oranli kucultur (kucukse buyutmez), WebP'e cevirir (kalite ~78).
 * Boylece hem yeni yuklemelerin hem Koton'dan cekilen gorsellerin Blob'daki boyutu
 * orijinaline gore %10-20'ye iner.
 */
export async function compressImage(buffer: Buffer): Promise<{ buffer: Buffer; contentType: string; ext: string }> {
  const output = await sharp(buffer)
    .rotate()
    .resize({ width: MAX_WIDTH, withoutEnlargement: true })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer();
  return { buffer: output, contentType: "image/webp", ext: "webp" };
}
