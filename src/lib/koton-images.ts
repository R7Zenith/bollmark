// Koton.com'dan barkod ile ürün sayfası bulup, renk bazlı görselleri ve ürün açıklamasını
// çekip Vercel Blob'a taşıyan fonksiyonlar (bkz. EXCEL_URUN_AKTARIM_PLANI.md bölüm 4).
// Sadece bu importla YENİ oluşturulan ürünler için çağrılır - mevcut ürünün fotoğrafı/
// açıklaması zaten varsa asla dokunulmaz. İstekler sıralı ve hız sınırlı atılır (ürün
// başına ~1 istek, aralarda kısa bekleme) - toplu/paralel tarama yapılmaz. Bir üründe
// arama başarısız olursa (bulunamadı/ağ hatası) hata yutulur, diğer ürünlerin aktarımı
// durmaz.
import { put } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import type { KotonEnrichmentTarget } from "@/lib/excel-import";

const KOTON_BASE = "https://www.koton.com";
const REQUEST_DELAY_MS = 900;
const MAX_IMAGES_PER_COLOR = 6;
const USER_AGENT = "Mozilla/5.0 (compatible; BollmarkImportBot/1.0; +https://www.bollmark.com)";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface KotonProductData {
  description: string | null;
  colorImageUrls: Map<string, string[]>; // Koton renk etiketi (örn. "EKRU") -> tam görsel URL'leri
}

async function fetchAutocompleteUrl(barcode: string): Promise<string | null> {
  const res = await fetch(`${KOTON_BASE}/autocomplete/?search_text=${encodeURIComponent(barcode)}`, {
    headers: { "User-Agent": USER_AGENT }
  });
  if (!res.ok) return null;
  const data = await res.json();
  const groups: unknown[] = Array.isArray(data?.groups) ? data.groups : [];
  for (const group of groups) {
    const entries: unknown[] = Array.isArray((group as { entries?: unknown[] })?.entries)
      ? (group as { entries: unknown[] }).entries
      : [];
    for (const entry of entries) {
      const e = entry as { suggestion_type?: string; url?: string };
      if (e?.suggestion_type === "product" && typeof e.url === "string" && e.url) {
        return e.url;
      }
    }
  }
  return null;
}

async function fetchKotonProductData(
  productUrl: string,
  expectedProductCode: string
): Promise<KotonProductData | null> {
  const absoluteUrl = productUrl.startsWith("http") ? productUrl : `${KOTON_BASE}${productUrl}`;
  const separator = absoluteUrl.includes("?") ? "&" : "?";
  const res = await fetch(`${absoluteUrl}${separator}format=json`, {
    headers: { "User-Agent": USER_AGENT }
  });
  if (!res.ok) return null;
  const data = await res.json();

  const baseCode = data?.product?.base_code;
  if (baseCode !== expectedProductCode) return null;

  const description =
    typeof data?.product?.attributes?.urun_aciklama === "string" ? data.product.attributes.urun_aciklama : null;

  const colorImageUrls = new Map<string, string[]>();
  const variantGroups: unknown[] = Array.isArray(data?.variants) ? data.variants : [];
  const colorGroup = variantGroups.find((v) => (v as { attribute_name?: string })?.attribute_name === "Renk") as
    | { options?: unknown[] }
    | undefined;

  for (const option of colorGroup?.options ?? []) {
    const o = option as { label?: string; product?: { productimage_set?: unknown[] } };
    const label = typeof o?.label === "string" ? o.label : null;
    const imageSet: unknown[] = Array.isArray(o?.product?.productimage_set) ? o.product!.productimage_set! : [];
    const images = imageSet
      .map((img) => (img as { image?: string })?.image)
      .filter((url): url is string => typeof url === "string" && url.length > 0);
    if (label && images.length > 0) colorImageUrls.set(label, images);
  }

  return { description, colorImageUrls };
}

async function findKotonProductData(barcode: string, productCode: string): Promise<KotonProductData | null> {
  try {
    const url = await fetchAutocompleteUrl(barcode);
    if (!url) return null;
    return await fetchKotonProductData(url, productCode);
  } catch (error) {
    console.error(`Koton'dan ürün verisi alınamadı (barkod: ${barcode}):`, error);
    return null;
  }
}

async function reuploadImageToBlob(sourceUrl: string, pathHint: string): Promise<string | null> {
  try {
    const res = await fetch(sourceUrl, { headers: { "User-Agent": USER_AGENT } });
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") || "image/jpeg";
    const ext = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
    const buffer = Buffer.from(await res.arrayBuffer());
    const blob = await put(`koton-import/${pathHint}.${ext}`, buffer, {
      access: "public",
      contentType,
      addRandomSuffix: true
    });
    return blob.url;
  } catch (error) {
    console.error(`Görsel indirilip yeniden yüklenemedi (${sourceUrl}):`, error);
    return null;
  }
}

export interface KotonEnrichmentResult {
  productId: string;
  productCode: string;
  found: boolean;
  imagesAdded: number;
  descriptionUpdated: boolean;
}

async function enrichOne(target: KotonEnrichmentTarget): Promise<KotonEnrichmentResult> {
  const result: KotonEnrichmentResult = {
    productId: target.productId,
    productCode: target.productCode,
    found: false,
    imagesAdded: 0,
    descriptionUpdated: false
  };

  const data = await findKotonProductData(target.firstBarcode, target.productCode);
  if (!data) return result;
  result.found = true;

  if (data.description) {
    await prisma.product.update({ where: { id: target.productId }, data: { description: data.description } });
    result.descriptionUpdated = true;
  }

  for (const [label, valueId] of Object.entries(target.colorValueIdByLabel)) {
    const urls = data.colorImageUrls.get(label);
    if (!urls || urls.length === 0) continue;

    const uploaded: string[] = [];
    for (const sourceUrl of urls.slice(0, MAX_IMAGES_PER_COLOR)) {
      const blobUrl = await reuploadImageToBlob(sourceUrl, `${target.productCode}-${label}-${uploaded.length}`);
      if (blobUrl) uploaded.push(blobUrl);
    }
    if (uploaded.length > 0) {
      await prisma.productOptionImage.createMany({
        data: uploaded.map((url, i) => ({
          productId: target.productId,
          valueId,
          url,
          alt: `${target.productName} - ${label}`,
          position: i
        }))
      });
      result.imagesAdded += uploaded.length;
    }
  }

  return result;
}

// Verilen (yeni oluşturulan) ürünler için sırayla Koton'da arama yapar - aralarda kısa
// bekleme ile hız sınırlı çalışır. Bir üründe hata olsa da diğerlerine devam eder.
export async function enrichProductsFromKoton(
  targets: KotonEnrichmentTarget[]
): Promise<KotonEnrichmentResult[]> {
  const results: KotonEnrichmentResult[] = [];
  for (let i = 0; i < targets.length; i++) {
    if (i > 0) await sleep(REQUEST_DELAY_MS);
    try {
      results.push(await enrichOne(targets[i]));
    } catch (error) {
      console.error(`Koton görsel eşleştirme başarısız (ürün kodu: ${targets[i].productCode}):`, error);
      results.push({
        productId: targets[i].productId,
        productCode: targets[i].productCode,
        found: false,
        imagesAdded: 0,
        descriptionUpdated: false
      });
    }
  }
  return results;
}
