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
import { sanitizeDescriptionHtml } from "@/lib/description-html";
import { compressImage } from "@/lib/image-compress";

const KOTON_BASE = "https://www.koton.com";
const REQUEST_DELAY_MS = 900;
const MAX_IMAGES_PER_COLOR = 6;
const USER_AGENT = "Mozilla/5.0 (compatible; BollmarkImportBot/1.0; +https://www.bollmark.com)";
const FETCH_TIMEOUT_MS = 8000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

interface KotonProductData {
  description: string | null;
  colorImageUrls: Map<string, string[]>; // normalizeColorLabel(renk) -> tam görsel URL'leri
  // Koton, urunun tek rengi varsa (renk secici gerekmiyorsa) ve/veya urun tamamen
  // stok disiysa `variants` dizisini bos donduruyor - bu durumda gorseller sadece
  // `product.productimage_set`'te (renkten bagimsiz, dogrudan urune bagli) bulunuyor.
  // Bu alan o durum icin bir yedek: hicbir renk grubu yoksa kullaniliyor.
  fallbackImageUrls: string[];
}

// Koton'un ürün sayfasındaki renk etiketleri (örn. "LACİVERT ÇİZGİLİ") ile Excel'den
// gelen renk adları (örn. "Lacivert Çizgili") sadece büyük/küçük harfte farklılaşabiliyor -
// bu yüzden eşleştirme öncesi ikisi de aynı şekilde normalize ediliyor (Türkçe locale ile,
// "i"/"İ" ve "ı"/"I" çiftlerinin doğru büyütülmesi için `toLocaleUpperCase("tr-TR")` kullanılıyor).
function normalizeColorLabel(label: string): string {
  return label.trim().toLocaleUpperCase("tr-TR");
}

async function fetchAutocompleteUrl(searchText: string): Promise<string | null> {
  const res = await fetchWithTimeout(`${KOTON_BASE}/autocomplete/?search_text=${encodeURIComponent(searchText)}`, {
    headers: { "User-Agent": USER_AGENT }
  });
  if (!res.ok) {
    console.error(`Koton autocomplete başarısız (${searchText}): HTTP ${res.status}`);
    return null;
  }
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

// Koton'un kendi arama uc noktalari (autocomplete/list) bazi urunler icin (ozellikle
// arama indeksinden dusmus, tamamen stok disi kalmis urunler) hicbir sonuc vermiyor -
// bkz. DEPLOY_STATUS.md, 6SAK40062PW ornegi. Bu urunler koton.com'da hala erisilebilir
// (dogrudan URL calisiyor), sadece site ici aramaya girmiyor. Son bir deneme olarak
// Google Custom Search JSON API'de (koton.com'a kisitlanmis bir arama motoru ile)
// urun kodu araniyor. Daha once anahtarsiz DuckDuckGo HTML scraping'i denendi ama
// Vercel'in sunucu IP'lerinden gelen istekleri bot trafigi sayip sessizce bos sonuc
// donduruyordu (bkz. DEPLOY_STATUS.md) - Google'in resmi API'si (gunluk 100 sorgu
// ucretsiz) bu sorunu yasamiyor. `GOOGLE_CSE_API_KEY`/`GOOGLE_CSE_CX` tanimli degilse
// bu adim sessizce atlaniyor (ozellik devre disi kalir, hata vermez).
async function fetchGoogleCseUrl(query: string): Promise<string | null> {
  const apiKey = process.env.GOOGLE_CSE_API_KEY;
  const cx = process.env.GOOGLE_CSE_CX;
  if (!apiKey || !cx) return null;

  try {
    const url = `https://www.googleapis.com/customsearch/v1?key=${encodeURIComponent(apiKey)}&cx=${encodeURIComponent(cx)}&q=${encodeURIComponent(query)}`;
    const res = await fetchWithTimeout(url);
    if (!res.ok) {
      console.error(`Google arama başarısız (${query}): HTTP ${res.status}`);
      return null;
    }
    const data = await res.json();
    const items: unknown[] = Array.isArray(data?.items) ? data.items : [];
    for (const item of items) {
      const link = (item as { link?: string })?.link;
      if (typeof link === "string" && /^https?:\/\/(www\.)?koton\.com\//i.test(link)) {
        return link;
      }
    }
    return null;
  } catch (error) {
    console.error(`Google araması başarısız oldu (${query}):`, error);
    return null;
  }
}

async function fetchKotonProductData(
  productUrl: string,
  expectedProductCode: string
): Promise<KotonProductData | null> {
  const absoluteUrl = productUrl.startsWith("http") ? productUrl : `${KOTON_BASE}${productUrl}`;
  const separator = absoluteUrl.includes("?") ? "&" : "?";
  const res = await fetchWithTimeout(`${absoluteUrl}${separator}format=json`, {
    headers: { "User-Agent": USER_AGENT }
  });
  if (!res.ok) return null;
  const data = await res.json();

  const baseCode = data?.product?.base_code;
  if (baseCode !== expectedProductCode) {
    console.error(`Koton base_code eşleşmedi: beklenen ${expectedProductCode}, gelen ${baseCode}`);
    return null;
  }

  const rawDescription =
    typeof data?.product?.attributes?.urun_aciklama === "string" ? data.product.attributes.urun_aciklama : null;
  const description = rawDescription ? sanitizeDescriptionHtml(rawDescription) : null;

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
    if (label && images.length > 0) colorImageUrls.set(normalizeColorLabel(label), images);
  }

  const productImageSet: unknown[] = Array.isArray(data?.product?.productimage_set)
    ? data.product.productimage_set
    : [];
  const fallbackImageUrls = productImageSet
    .map((img) => (img as { image?: string })?.image)
    .filter((url): url is string => typeof url === "string" && url.length > 0);

  return { description, colorImageUrls, fallbackImageUrls };
}

async function findKotonProductData(barcode: string, productCode: string): Promise<KotonProductData | null> {
  try {
    const barcodeUrl = await fetchAutocompleteUrl(barcode);
    if (barcodeUrl) {
      const data = await fetchKotonProductData(barcodeUrl, productCode);
      if (data) {
        console.log(`Koton eşleşmesi (${productCode}): barkod ile bulundu`);
        return data;
      }
    }

    const productCodeUrl = await fetchAutocompleteUrl(productCode);
    if (productCodeUrl) {
      const data = await fetchKotonProductData(productCodeUrl, productCode);
      if (data) {
        console.log(`Koton eşleşmesi (${productCode}): ürün kodu ile bulundu`);
        return data;
      }
    }

    // Koton'un kendi aramasi (autocomplete) hicbir sonuc vermedi - son care olarak
    // Google Custom Search'te urun kodu aranip ilk koton.com sonucu deneniyor.
    const webSearchUrl = await fetchGoogleCseUrl(productCode);
    if (webSearchUrl) {
      const data = await fetchKotonProductData(webSearchUrl, productCode);
      if (data) {
        console.log(`Koton eşleşmesi (${productCode}): Google araması ile bulundu (${webSearchUrl})`);
        return data;
      }
    }

    console.log(`Koton eşleşmesi (${productCode}): bulunamadı`);
    return null;
  } catch (error) {
    console.error(`Koton'dan ürün verisi alınamadı (barkod: ${barcode}, ürün kodu: ${productCode}):`, error);
    return null;
  }
}

// Bir kaynak URL'den görseli indirip kendi Vercel Blob depomuza yeniden yükler - Koton'un
// kendi CDN'ine hotlink yapmamak (URL değişirse/engellenirse kırılmasın) için. Hem Koton
// içe aktarımı hem admin panelindeki "Görsel linkiyle ekle" elle-ekleme akışı tarafından
// kullanılıyor.
export async function reuploadImageToBlob(
  sourceUrl: string,
  pathHint: string,
  folder = "koton-import"
): Promise<string | null> {
  try {
    const res = await fetchWithTimeout(sourceUrl, { headers: { "User-Agent": USER_AGENT } });
    if (!res.ok) return null;
    const original = Buffer.from(await res.arrayBuffer());
    const { buffer, contentType, ext } = await compressImage(original);
    const blob = await put(`${folder}/${pathHint}.${ext}`, buffer, {
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

// `findKotonProductData` (arama ile) veya dogrudan verilen bir URL (`enrichFromUrl`)
// uzerinden elde edilen `KotonProductData`'yi hedef urune uygular: aciklamayi (istenirse)
// gunceller, renk bazinda gorselleri indirip Blob'a yukler ve `ProductOptionImage`
// kayitlarini olusturur. Her iki giris yolu da (arama/manuel URL) ayni mantigi kullanir.
async function applyKotonProductData(
  target: KotonEnrichmentTarget,
  data: KotonProductData,
  overwriteDescription: boolean
): Promise<KotonEnrichmentResult> {
  const result: KotonEnrichmentResult = {
    productId: target.productId,
    productCode: target.productCode,
    found: true,
    imagesAdded: 0,
    descriptionUpdated: false
  };

  if (data.description && overwriteDescription) {
    await prisma.product.update({ where: { id: target.productId }, data: { description: data.description } });
    result.descriptionUpdated = true;
  }

  const targetColors = Object.entries(target.colorValueIdByLabel);
  // Koton'un `variants` (Renk) dizisi tamamen bossa (urunun tek rengi var ya da urun
  // tamamen stok disi oldugu icin renk secici olusturulmamis), tek renkli bir hedef
  // icin `product.productimage_set` yedegini kullan - birden fazla renk beklenirken
  // Koton'un tek bir renge ait gorselleri yanlislikla hepsine uygulamamak icin sadece
  // hedefte de tek renk oldugunda devreye giriyor.
  const useFallback = data.colorImageUrls.size === 0 && targetColors.length === 1 && data.fallbackImageUrls.length > 0;

  for (const [label, valueId] of targetColors) {
    const urls = useFallback ? data.fallbackImageUrls : data.colorImageUrls.get(normalizeColorLabel(label));
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

  if (result.imagesAdded === 0) {
    console.error(
      `Koton eşleşmesi (${target.productCode}): sayfa bulundu ama hiç renk eşleşmedi - beklenen renkler: ` +
        `${Object.keys(target.colorValueIdByLabel).join(", ")}, Koton'daki renkler: ` +
        `${[...data.colorImageUrls.keys()].join(", ")}`
    );
  }

  return result;
}

export async function enrichOne(
  target: KotonEnrichmentTarget,
  options?: { overwriteDescription?: boolean }
): Promise<KotonEnrichmentResult> {
  const data = await findKotonProductData(target.firstBarcode, target.productCode);
  if (!data) {
    return {
      productId: target.productId,
      productCode: target.productCode,
      found: false,
      imagesAdded: 0,
      descriptionUpdated: false
    };
  }
  return applyKotonProductData(target, data, options?.overwriteDescription ?? true);
}

// Otomatik arama (autocomplete/list) hicbir sonuc vermedigi urunler icin: admin'in
// koton.com'da elle bulup verdigi dogrudan urun sayfasi URL'inden gorselleri/aciklamayi
// ceker. Arama adimini tamamen atlar, sadece verilen URL'i `?format=json` ile okur.
export async function enrichFromUrl(
  target: KotonEnrichmentTarget,
  productUrl: string,
  options?: { overwriteDescription?: boolean }
): Promise<KotonEnrichmentResult> {
  const emptyResult: KotonEnrichmentResult = {
    productId: target.productId,
    productCode: target.productCode,
    found: false,
    imagesAdded: 0,
    descriptionUpdated: false
  };
  let data: KotonProductData | null;
  try {
    data = await fetchKotonProductData(productUrl, target.productCode);
  } catch (error) {
    console.error(`Koton URL'inden ürün verisi alınamadı (${productUrl}):`, error);
    return emptyResult;
  }
  if (!data) return emptyResult;
  return applyKotonProductData(target, data, options?.overwriteDescription ?? false);
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
