// Slazenger.com.tr icin ayri gorsel/aciklama bulma motoru (bkz.
// COK_MARKALI_GORSEL_BULMA_PLANI.md - "slazenger-arama" stratejisi, brand-image-sources.ts).
// Koton'dan (koton-images.ts) FARKLI bir altyapi: Slazenger urun sayfalari `?format=json`
// DESTEKLEMIYOR (denendi, dogrulandi - normal HTML donuyor). Onun yerine:
// 1) Sitenin kendi arama sayfasi (`/arama?q=<urun adinin ilk kelimesi>`) HTML sonuc
//    listesi taraniyor - her renk Slazenger'da AYRI bir urun sayfasi/URL (Koton'daki gibi
//    tek sayfada `variants` dizisi yok).
// 2) Sonuc karti basligindan (orn. "Slazenger FESKA Erkek Bej Gunluk Spor Ayakkabisi")
//    hangi rengin hangi karta ait oldugu tespit ediliyor.
// 3) Eslesen rengin sayfasi cekilip icindeki tek `<script type="application/ld+json">`
//    (schema.org Product) bloğundan `sku` (urun kodu dogrulamasi icin), `description`
//    (duz metin) ve `image` (o renge ozel gorsel URL'leri) okunuyor.
// Koton tarafi (koton-images.ts) bu dosyadan hic etkilenmiyor, sadece ortak
// `reuploadImageToBlob` yardimcisini paylasiyorlar.
import * as cheerio from "cheerio";
import { prisma } from "@/lib/prisma";
import type { KotonEnrichmentTarget } from "@/lib/excel-import";
import type { KotonEnrichmentResult } from "@/lib/koton-images";
import { reuploadImageToBlob } from "@/lib/koton-images";
import { sanitizeDescriptionHtml } from "@/lib/description-html";

const USER_AGENT = "Mozilla/5.0 (compatible; BollmarkImportBot/1.0; +https://www.bollmark.com)";
const FETCH_TIMEOUT_MS = 8000;
// Bir urunun Slazenger'da gercekte kac fotografi oldugu degisken - 6'da sabitlemek
// bazi urunlerde (orn. 7-8 fotografli) fotograf eksik birakiyordu. Makul bir ust sinir
// (asiri buyuk galerilerde bosuna onlarca istek atmamak icin) olarak 16 kullanildi.
const MAX_IMAGES_PER_COLOR = 16;

async function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

function normalizeColorLabel(label: string): string {
  return label.trim().toLocaleUpperCase("tr-TR");
}

// Bazı ürünlerde Slazenger'ın kendi sitesinde henüz gerçek fotoğraf yok - ld+json
// "image" alanı bu durumda "fotoğraf hazırlanıyor" placeholder'ına işaret eden GÖRELİ
// (baseUrl olmadan çözülemeyen) bir yol döndürüyor (örn.
// "/Data/EditorFiles/urun-gorseli-hazirlaniyor.svg"). Bunlar gerçek görsel değil -
// filtrelenip atılıyor (renk "bulunamadı" sayılır, admin elle ekleyebilir); geri kalan
// göreli yollar da baseUrl ile mutlak hale getiriliyor.
const PLACEHOLDER_IMAGE_PATTERN = /urun-gorseli-hazirlaniyor/i;

// ld+json'daki "image" URL'leri "www.slazenger.com.tr/...-O.jpg" seklinde geliyor - "-O"
// "orijinal" gibi gorunse de gercekte site galerisindeki en kucuk/thumbnail boyut
// (dogrulandi: 371x557px). Sitenin kendi urun sayfasinda gercekten gosterilen buyuk
// gorsel, "img.slazenger.com.tr" alt alanindaki AYNI dosya adinin "-B" (buyuk) suffix'li
// hali (dogrulandi: 1200x1800px). Desen tutmuyorsa (beklenmedik bir URL formati) orijinal
// URL oldugu gibi birakilir - hicbir zaman gorseli tamamen kaybetmemek icin.
function upgradeToLargeVariant(url: string): string {
  const match = url.match(/^https?:\/\/(?:www\.)?slazenger\.com\.tr\/(.+)-O\.jpg$/i);
  if (!match) return url;
  return `https://img.slazenger.com.tr/${match[1]}-B.jpg`;
}

function resolveImageUrls(rawImages: unknown, baseUrl: string): string[] {
  if (!Array.isArray(rawImages)) return [];
  return rawImages
    .filter((u): u is string => typeof u === "string" && u.length > 0)
    .filter((u) => !PLACEHOLDER_IMAGE_PATTERN.test(u))
    .map((u) => (u.startsWith("http") ? u : `${baseUrl}${u.startsWith("/") ? "" : "/"}${u}`))
    .map(upgradeToLargeVariant);
}

interface SearchCandidate {
  url: string;
  title: string;
}

// Arama sonuc sayfasindaki urun kartlarinin baslik+link'ini toplar. Her urun karti
// iki ayni `a.detailLink` iceriyor (gorsel + baslik) - href bazinda tekillestiriliyor.
async function searchCandidates(baseUrl: string, query: string): Promise<SearchCandidate[]> {
  const res = await fetchWithTimeout(`${baseUrl}/arama?q=${encodeURIComponent(query)}`, {
    headers: { "User-Agent": USER_AGENT }
  });
  if (!res.ok) return [];
  const html = await res.text();
  const $ = cheerio.load(html);
  const byHref = new Map<string, string>();
  $("a.detailLink[title]").each((_, el) => {
    const href = $(el).attr("href");
    const title = $(el).attr("title");
    if (href && title && !byHref.has(href)) byHref.set(href, title);
  });
  return Array.from(byHref.entries()).map(([url, title]) => ({ url, title }));
}

// Bir aday karti belirli bir renge mi ait tespit eder. Baslikta "/" varsa ("Siyah /
// Beyaz" gibi coklu renk kombinasyonu) kasitli olarak REDDEDILIYOR - tekil renk
// eslesmesinde yanlis pozitif riski almamak icin (orn. "Beyaz" hedefi "Siyah / Beyaz"
// kartiyla yanlislikla eslesmesin). Boyle durumlarda renk "bulunamadi" sayilir, admin
// panelden "linkle ekle" ile elle tamamlanabilir.
function candidateMatchesColor(title: string, colorLabel: string): boolean {
  const t = normalizeColorLabel(title);
  const c = normalizeColorLabel(colorLabel);
  if (!c || t.includes("/")) return false;
  const idx = t.indexOf(c);
  if (idx === -1) return false;
  const isWordChar = (ch: string | undefined) => !!ch && /[A-ZÇĞİÖŞÜ0-9]/.test(ch);
  if (isWordChar(t[idx - 1]) || isWordChar(t[idx + c.length])) return false;
  return true;
}

interface SlazengerProductData {
  description: string | null;
  images: string[];
}

// Verilen urun sayfasi URL'ini cekip icindeki schema.org Product ld+json blogunu
// okur. `sku` (orn. "SA26LE047-120") `expectedProductCode` ile BASLAMIYORSA null
// doner - yanlis urunle (arama sonuclarinda ayni kelimeyi iceren baska bir urun)
// eslesmeyi engelleyen tek dogrulama katmani bu.
async function fetchSlazengerProductData(
  productUrl: string,
  expectedProductCode: string,
  baseUrl: string
): Promise<SlazengerProductData | null> {
  const absoluteUrl = productUrl.startsWith("http") ? productUrl : `${baseUrl}${productUrl}`;
  const res = await fetchWithTimeout(absoluteUrl, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) return null;
  const html = await res.text();
  const $ = cheerio.load(html);

  let ld: Record<string, unknown> | null = null;
  $('script[type="application/ld+json"]').each((_, el) => {
    if (ld) return;
    try {
      const parsed = JSON.parse($(el).contents().text());
      if (parsed && parsed["@type"] === "Product") ld = parsed;
    } catch {
      // gecersiz JSON - yoksay, diger script bloklarina bak
    }
  });
  if (!ld) return null;

  const sku = typeof (ld as { sku?: unknown }).sku === "string" ? ((ld as { sku: string }).sku) : null;
  if (!sku || !sku.toUpperCase().startsWith(expectedProductCode.toUpperCase())) {
    console.error(`Slazenger sku eşleşmedi (${absoluteUrl}): beklenen ${expectedProductCode}, gelen ${sku}`);
    return null;
  }

  const rawDescription =
    typeof (ld as { description?: unknown }).description === "string"
      ? (ld as { description: string }).description
      : null;
  // Slazenger'in ld+json aciklamasi duz metin (Koton'daki gibi HTML degil) - satir
  // sonlarina gore paragraflara bolunup sanitizeDescriptionHtml ile izinli HTML'e
  // ceviriliyor.
  const description = rawDescription
    ? sanitizeDescriptionHtml(
        rawDescription
          .split(/\n+/)
          .map((line) => line.trim())
          .filter(Boolean)
          .map((line) => `<p>${line}</p>`)
          .join("")
      )
    : null;

  const images = resolveImageUrls((ld as { image?: unknown }).image, baseUrl);

  return { description, images };
}

export async function enrichOneSlazenger(
  target: KotonEnrichmentTarget,
  options?: { overwriteDescription?: boolean }
): Promise<KotonEnrichmentResult> {
  const overwriteDescription = options?.overwriteDescription ?? true;
  const result: KotonEnrichmentResult = {
    productId: target.productId,
    productCode: target.productCode,
    found: false,
    imagesAdded: 0,
    descriptionUpdated: false,
    missingColors: [],
    sourceDisplayName: target.imageSourceDisplayName
  };

  const baseUrl = target.imageSourceBaseUrl;
  if (!baseUrl) {
    result.missingColors = Object.keys(target.colorValueIdByLabel);
    return result;
  }

  // Kullanicinin kesfettigi yontem: Slazenger'da urun adinin ilk kelimesi (orn.
  // "FESKA Erkek Spor Ayakkabi" -> "FESKA") urunun model adi/aramaya uygun anahtar
  // kelimesi oluyor.
  const searchTerm = target.productName.trim().split(/\s+/)[0] ?? "";
  if (!searchTerm) {
    result.missingColors = Object.keys(target.colorValueIdByLabel);
    return result;
  }

  let candidates: SearchCandidate[];
  try {
    candidates = await searchCandidates(baseUrl, searchTerm);
  } catch (error) {
    console.error(`Slazenger araması başarısız (${searchTerm}):`, error);
    result.missingColors = Object.keys(target.colorValueIdByLabel);
    return result;
  }

  for (const [label, valueId] of Object.entries(target.colorValueIdByLabel)) {
    const candidate = candidates.find((c) => candidateMatchesColor(c.title, label));
    if (!candidate) {
      console.log(`Slazenger renk eşleştirme (${target.productCode}): "${label}" arama sonuçlarında bulunamadı`);
      result.missingColors.push(label);
      continue;
    }

    let data: SlazengerProductData | null;
    try {
      data = await fetchSlazengerProductData(candidate.url, target.productCode, baseUrl);
    } catch (error) {
      console.error(`Slazenger ürün sayfası okunamadı (${candidate.url}):`, error);
      data = null;
    }
    if (!data) {
      result.missingColors.push(label);
      continue;
    }
    result.found = true;

    if (data.description && overwriteDescription && !result.descriptionUpdated) {
      await prisma.product.update({ where: { id: target.productId }, data: { description: data.description } });
      result.descriptionUpdated = true;
    }

    const uploaded: string[] = [];
    for (const sourceUrl of data.images.slice(0, MAX_IMAGES_PER_COLOR)) {
      const blobUrl = await reuploadImageToBlob(sourceUrl, `${target.productCode}-${label}-${uploaded.length}`, "slazenger-import");
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
    } else {
      result.missingColors.push(label);
    }
  }

  return result;
}

// Otomatik arama (search) hicbir renk icin sonuc vermedigi durumlarda: admin'in
// slazenger.com.tr'de elle bulup verdigi dogrudan urun sayfasi URL'inden gorselleri/
// aciklamayi ceker. URL, hedefteki renklerden hangisine ait oldugunu ld+json aciklama/
// baslik uzerinden DEGIL, sayfanin kendi title/aciklamasindan renk adi aranarak tespit
// eder; hicbir renk eslesmezse (veya hedefte tek renk varsa) o tek renge fallback yapar
// (Koton'daki `enrichFromUrl`in tek-renk fallback mantigiyla ayni ruhta).
export async function enrichFromUrlSlazenger(
  target: KotonEnrichmentTarget,
  productUrl: string,
  options?: { overwriteDescription?: boolean }
): Promise<KotonEnrichmentResult> {
  const emptyResult: KotonEnrichmentResult = {
    productId: target.productId,
    productCode: target.productCode,
    found: false,
    imagesAdded: 0,
    descriptionUpdated: false,
    missingColors: Object.keys(target.colorValueIdByLabel),
    sourceDisplayName: target.imageSourceDisplayName
  };

  let html: string;
  try {
    const res = await fetchWithTimeout(productUrl, { headers: { "User-Agent": USER_AGENT } });
    if (!res.ok) return emptyResult;
    html = await res.text();
  } catch (error) {
    console.error(`Slazenger URL'inden ürün verisi alınamadı (${productUrl}):`, error);
    return emptyResult;
  }

  const $ = cheerio.load(html);
  let ld: Record<string, unknown> | null = null;
  $('script[type="application/ld+json"]').each((_, el) => {
    if (ld) return;
    try {
      const parsed = JSON.parse($(el).contents().text());
      if (parsed && parsed["@type"] === "Product") ld = parsed;
    } catch {
      // yoksay
    }
  });
  if (!ld) return emptyResult;

  const sku = typeof (ld as { sku?: unknown }).sku === "string" ? (ld as { sku: string }).sku : null;
  if (!sku || !sku.toUpperCase().startsWith(target.productCode.toUpperCase())) {
    console.error(`Slazenger URL sku eşleşmedi (${productUrl}): beklenen ${target.productCode}, gelen ${sku}`);
    return emptyResult;
  }

  const productName = typeof (ld as { name?: unknown }).name === "string" ? (ld as { name: string }).name : "";
  const colorEntries = Object.entries(target.colorValueIdByLabel);
  const matchedEntry =
    colorEntries.find(([label]) => candidateMatchesColor(productName, label)) ??
    (colorEntries.length === 1 ? colorEntries[0] : undefined);
  if (!matchedEntry) return emptyResult;
  const [label, valueId] = matchedEntry;

  const rawDescription =
    typeof (ld as { description?: unknown }).description === "string" ? (ld as { description: string }).description : null;
  const description = rawDescription
    ? sanitizeDescriptionHtml(
        rawDescription
          .split(/\n+/)
          .map((line) => line.trim())
          .filter(Boolean)
          .map((line) => `<p>${line}</p>`)
          .join("")
      )
    : null;
  const images = resolveImageUrls((ld as { image?: unknown }).image, target.imageSourceBaseUrl ?? "");

  const result: KotonEnrichmentResult = {
    productId: target.productId,
    productCode: target.productCode,
    found: true,
    imagesAdded: 0,
    descriptionUpdated: false,
    missingColors: colorEntries.filter(([l]) => l !== label).map(([l]) => l),
    sourceDisplayName: target.imageSourceDisplayName
  };

  if (description && (options?.overwriteDescription ?? false)) {
    await prisma.product.update({ where: { id: target.productId }, data: { description } });
    result.descriptionUpdated = true;
  }

  const uploaded: string[] = [];
  for (const sourceUrl of images.slice(0, MAX_IMAGES_PER_COLOR)) {
    const blobUrl = await reuploadImageToBlob(sourceUrl, `${target.productCode}-${label}-${uploaded.length}`, "slazenger-import");
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
    result.imagesAdded = uploaded.length;
  } else {
    result.missingColors.push(label);
  }

  return result;
}
