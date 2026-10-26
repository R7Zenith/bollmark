// Urun gorsellerinin yazildigi depo: Cloudflare R2 (bkz. R2_GORSEL_DEPOLAMA_PLANI.md,
// BLOB_TAMAMEN_KALDIRMA_PLANI.md). R2 ortam degiskenleri eksikse yukleme
// R2ConfigError firlatir; baska bir depoya sessizce yazilmaz.
import { randomBytes } from "node:crypto";
import { AwsClient } from "aws4fetch";

export class R2ConfigError extends Error {
  constructor() {
    super("Görsel deposu (R2) ayarları eksik. R2_ ile başlayan ortam değişkenlerini kontrol edin.");
  }
}

function r2Config() {
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_PUBLIC_BASE_URL } = process.env;
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET || !R2_PUBLIC_BASE_URL) return null;
  return {
    client: new AwsClient({
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
      service: "s3",
      region: "auto"
    }),
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET}`,
    publicBaseUrl: R2_PUBLIC_BASE_URL.replace(/\/+$/, "")
  };
}

// "DİLVİN 1267-SİYAH-0" -> "dilvin-1267-siyah-0": anahtar URL'de encode gerektirmesin.
function asciiSlug(text: string): string {
  const slug = text
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "gorsel";
}

async function putObject(r2: NonNullable<ReturnType<typeof r2Config>>, key: string, buffer: Buffer, contentType: string) {
  // client.fetch() DEGIL: o, govdeyi bir Request nesnesine sarar; Next.js'in fetch'i bunu
  // akis (chunked) olarak gonderir ve R2 Content-Length olmadigi icin 411 doner. Sadece
  // imza basliklari alinip govde dogrudan Uint8Array olarak (uzunlugu belli) gonderilir.
  const body = new Uint8Array(buffer);
  const signed = await r2.client.sign(`${r2.endpoint}/${key}`, {
    method: "PUT",
    body,
    headers: { "Content-Type": contentType, "Cache-Control": "public, max-age=31536000, immutable" }
  });
  const res = await fetch(signed.url, { method: "PUT", headers: signed.headers, body, cache: "no-store" });
  if (!res.ok) throw new Error(`R2 yüklemesi başarısız (${res.status}): ${key}`);
}

// jpeg verilirse (compressImage ciktisi) ayni adla .jpg kopyasi da yazilir - Meta
// katalogu WebP kabul etmiyor (bkz. jpegCopyUrl, lib/merchant-feed.ts).
export async function uploadImage(input: {
  folder: string;
  nameHint: string;
  buffer: Buffer;
  contentType: string;
  ext: string;
  jpeg?: Buffer;
}): Promise<string> {
  const r2 = r2Config();
  if (!r2) throw new R2ConfigError();

  const base = `${input.folder}/${asciiSlug(input.nameHint)}-${randomBytes(4).toString("hex")}`;
  await Promise.all([
    putObject(r2, `${base}.${input.ext}`, input.buffer, input.contentType),
    input.jpeg && putObject(r2, `${base}.jpg`, input.jpeg, "image/jpeg")
  ]);
  return `${r2.publicBaseUrl}/${base}.${input.ext}`;
}

// R2'deki .webp gorselin JPEG kopyasinin adresi; kopyasi olmayan (R2 disi ya da
// WebP olmayan) gorselde null.
export function jpegCopyUrl(url: string): string | null {
  return isR2Url(url) && url.endsWith(".webp") ? url.replace(/\.webp$/, ".jpg") : null;
}

export function isR2Url(url: string): boolean {
  const base = process.env.R2_PUBLIC_BASE_URL;
  if (!base) return false;
  try {
    return new URL(url).hostname === new URL(base).hostname;
  } catch {
    return false;
  }
}

// Sadece isR2Url'den gecen adresler icin cagrilir (bkz. lib/blob.ts). Hata firlatmaz.
export async function deleteR2Urls(urls: string[]): Promise<void> {
  const r2 = r2Config();
  if (!r2 || urls.length === 0) return;
  // .webp ile birlikte JPEG kopyasi da silinir (yoksa R2 sessizce 204 doner).
  const withCopies = urls.flatMap((url) => [url, jpegCopyUrl(url)].filter((u): u is string => u !== null));
  const results = await Promise.allSettled(
    withCopies.map(async (url) => {
      const res = await r2.client.fetch(`${r2.endpoint}${new URL(url).pathname}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`${res.status} ${url}`);
    })
  );
  for (const result of results) {
    if (result.status === "rejected") console.error("R2 gorseli silinemedi (yoksayildi):", result.reason);
  }
}
