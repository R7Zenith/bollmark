// Otomatik arama yapilmayan markalar (orn. Quzu, bkz. brand-image-sources.ts
// MANUAL_LINK_BRANDS) icin "Linkle Ekle" gorsel cekici: admin urun sayfasinin linkini
// yapistirir ve rengi kendisi secer. Sayfadaki fotograflarin hepsi secilen renge yazilir
// (bu sitelerde her renk ayri bir urun sayfasi). Urun kodu dogrulamasi bilerek yapilmiyor -
// hangi link verilirse o cekilir. Iki sayfa turu destekleniyor:
// - Shopify (quzu.com.tr): `/products/<handle>.json` -> product.images[].src
// - Diger (quzuwholesale.com / Ticimax vb.): sayfadaki schema.org Product ld+json `image`
import * as cheerio from "cheerio";
import sharp from "sharp";
import { prisma } from "@/lib/prisma";
import { compressImage } from "@/lib/image-compress";
import { uploadImage } from "@/lib/image-storage";

const USER_AGENT = "Mozilla/5.0 (compatible; BollmarkImportBot/1.0; +https://www.bollmark.com)";
const FETCH_TIMEOUT_MS = 8000;
const MAX_IMAGES = 16;

async function fetchImageUrls(productUrl: string): Promise<string[] | null> {
  try {
    const parsed = new URL(productUrl);
    const init = { headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) };

    const shopifyHandle = parsed.pathname.match(/\/products\/([^/]+)/)?.[1];
    if (shopifyHandle) {
      const res = await fetch(`${parsed.origin}/products/${shopifyHandle}.json`, init);
      if (!res.ok) return null;
      const data = (await res.json()) as { product?: { images?: Array<{ src?: unknown }> } };
      return (data.product?.images ?? []).map((img) => img.src).filter((src): src is string => typeof src === "string");
    }

    const res = await fetch(productUrl, init);
    if (!res.ok) return null;
    const $ = cheerio.load(await res.text());
    let images: string[] | null = null;
    $('script[type="application/ld+json"]').each((_, el) => {
      if (images) return;
      try {
        const ld = JSON.parse($(el).contents().text());
        if (ld?.["@type"] !== "Product") return;
        const raw: unknown[] = Array.isArray(ld.image) ? ld.image : [ld.image];
        images = raw
          .filter((u): u is string => typeof u === "string" && u.length > 0)
          .map((u) => new URL(u, parsed.origin).href);
      } catch {
        // gecersiz JSON - yoksay, diger script bloklarina bak
      }
    });
    return images;
  } catch (error) {
    console.error(`Linkten ürün görselleri alınamadı (${productUrl}):`, error);
    return null;
  }
}

// Sitedeki kart ve urun sayfasi cercevesi 3:4 (aspect-[3/4] + object-cover). Bu
// sitelerin fotograflari 2:3 (1200x1800) oldugu icin mankenin basi ve ayaklari
// kirpiliyordu. Fotograf 3:4'ten dar ise saga ve sola, kenarin ayna goruntusuyle
// esit serit eklenip 3:4'e tamamlanir; 3:4 veya daha genis fotograflara dokunulmaz.
export async function padToCardRatio(buffer: Buffer): Promise<Buffer> {
  const { width, height } = await sharp(buffer).metadata();
  if (!width || !height) return buffer;
  const pad = Math.round((height * 3) / 4) - width;
  if (pad <= 0) return buffer;
  const left = Math.floor(pad / 2);
  return sharp(buffer).extend({ left, right: pad - left, extendWith: "mirror" }).png().toBuffer();
}

async function downloadAndUpload(sourceUrl: string, nameHint: string): Promise<string | null> {
  try {
    const res = await fetch(sourceUrl, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
    });
    if (!res.ok) return null;
    const padded = await padToCardRatio(Buffer.from(await res.arrayBuffer()));
    return await uploadImage({ folder: "link-import", nameHint, ...(await compressImage(padded)) });
  } catch (error) {
    console.error(`Görsel indirilip yüklenemedi (${sourceUrl}):`, error);
    return null;
  }
}

// color null ise (urunun renk varyanti yok) fotograflar urunun genel galerisine eklenir.
// Mevcut fotograflarin SONUNA eklenir, hicbir sey silinmez.
export async function addImagesFromLink(
  product: { id: string; code: string; name: string },
  productUrl: string,
  color: { label: string; valueId: string } | null
): Promise<{ found: boolean; imagesAdded: number }> {
  const sourceUrls = await fetchImageUrls(productUrl);
  if (!sourceUrls) return { found: false, imagesAdded: 0 };

  const uploaded: string[] = [];
  for (const sourceUrl of sourceUrls.slice(0, MAX_IMAGES)) {
    const hint = `${product.code}-${color ? `${color.label}-` : ""}${uploaded.length}`;
    const blobUrl = await downloadAndUpload(sourceUrl, hint);
    if (blobUrl) uploaded.push(blobUrl);
  }
  if (uploaded.length === 0) return { found: true, imagesAdded: 0 };

  if (color) {
    const offset = await prisma.productOptionImage.count({ where: { productId: product.id, valueId: color.valueId } });
    await prisma.productOptionImage.createMany({
      data: uploaded.map((url, i) => ({
        productId: product.id,
        valueId: color.valueId,
        url,
        alt: `${product.name} - ${color.label}`,
        position: offset + i
      }))
    });
  } else {
    const offset = await prisma.productImage.count({ where: { productId: product.id } });
    await prisma.productImage.createMany({
      data: uploaded.map((url, i) => ({ productId: product.id, url, alt: product.name, position: offset + i }))
    });
  }
  return { found: true, imagesAdded: uploaded.length };
}
