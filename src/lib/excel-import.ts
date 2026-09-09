// Dükkanın checklist excel'inden (bkz. EXCEL_URUN_AKTARIM_PLANI.md) toplu ürün/varyant
// aktarımı - Faz A (parse) ve Faz B (grupla + upsert) burada. Kolon adları örnek dosyadaki
// gibi sabit kabul edilir; eksik/bozuk satır olursa satır no'suyla hata biriktirilir, tüm
// dosya reddedilmez.
import * as XLSX from "xlsx";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { resolveOptionValueIds } from "@/lib/variant-attributes";

type Tx = PrismaClient | Prisma.TransactionClient;

export interface ExcelImportRow {
  rowNumber: number; // excel satır no (header = 1)
  productCode: string; // ÜRÜN KODU
  productName: string; // ÜRÜN ADI
  barcode: string; // BARKOD
  genderRaw: string; // KOD4
  categoryRaw: string; // KOD3
  color: string; // RENK
  size: string; // BEDEN
  costCents: number | null; // AFIYATI
  priceCents: number; // SFIYAT1
  stock: number; // MİKTAR
  brandName: string; // FIRMAADI
}

export interface ExcelParseError {
  row: number;
  message: string;
}

export interface ExcelParseResult {
  rows: ExcelImportRow[];
  errors: ExcelParseError[];
}

// Koton checklist'lerinde gördüğümüz KOD4 (cinsiyet) değerlerinin Türkçe karşılığı -
// eşleşmeyen değerler boş bırakılır (bkz. plan bölüm 3). TEENAGE (genç) için sitede
// ayrı bir gender/kategori dalı yok (Kadın/Erkek/Aksesuar), pratikte kadın kataloğuna
// giriyor - dolayısıyla Kadın'a eşleniyor.
const GENDER_MAP: Record<string, string> = {
  MEN: "Erkek",
  ERKEK: "Erkek",
  WOMEN: "Kadın",
  KADIN: "Kadın",
  TEENAGE: "Kadın",
  KIDS: "Çocuk",
  COCUK: "Çocuk",
  ÇOCUK: "Çocuk",
  UNISEX: "Unisex"
};

export function mapGender(genderRaw: string): string | null {
  return GENDER_MAP[genderRaw.trim().toUpperCase()] ?? null;
}

// Koton checklist'lerindeki KOD3 (urun grubu) degerlerinin Bollmark kategori
// adina karsiligi. Haritada olmayan bir deger gelirse mapCategoryName null
// doner, ithalat onizlemede "eslesmedi" olarak gosterilir - yoneticinin
// secili fallback kategoriye duser. Yeni bir urun tipi geldikce buraya
// eklenir.
const CATEGORY_MAP: Record<string, string> = {
  "SHIRTS SS": "Gömlek",
  "SHIRTS LS BSC": "Gömlek",
  SHORTS: "Şort",
  TROUSERS: "Pantolon",
  "BIKINI BOTTOMS": "Mayo & Bikini"
};

export function mapCategoryName(categoryRaw: string): string | null {
  return CATEGORY_MAP[categoryRaw.trim().toUpperCase()] ?? null;
}

// KOD3 (öğrenilmiş eşleme + CATEGORY_MAP) karşılığı yoksa, AI önerisine gitmeden
// önce ürün adında geçen anahtar kelimeye bakarak ücretsiz/deterministik bir tahmin
// denenir. Bu bir KESİN eşleşme değildir - önizlemede "öneri" olarak gösterilir,
// yönetici onaylar/değiştirir (AI önerisiyle aynı güvenlik prensibi). Liste sitenin
// gerçek kategori ağacındaki isimlere göre güncel tutulmalı. Sıra önemli - daha
// spesifik türler (Kot Pantolon, Şort) genel olanlardan (Pantolon) önce kontrol
// edilmeli ki "kot pantolon" ifadesi yanlışlıkla sade "Pantolon"a düşmesin.
const PRODUCT_NAME_CATEGORY_KEYWORDS: Array<{ category: string; keywords: string[] }> = [
  { category: "Şort", keywords: ["şort"] },
  { category: "Etek", keywords: ["etek"] },
  { category: "Kot Pantolon", keywords: ["jean", "kot pantolon", "denim pantolon"] },
  { category: "Pantolon", keywords: ["pantolon", "paça"] },
  { category: "Elbise", keywords: ["elbise"] },
  { category: "Bluz", keywords: ["bluz"] },
  { category: "Gömlek", keywords: ["gömlek"] },
  { category: "Tişört", keywords: ["tişört", "t-shirt", "tshirt"] },
  { category: "Sweatshirt", keywords: ["sweatshirt"] },
  { category: "Hırka", keywords: ["hırka"] },
  { category: "Kazak & Süveter", keywords: ["kazak", "süveter", "triko"] },
  { category: "Trençkot", keywords: ["trençkot", "trenchcoat"] },
  { category: "Mont & Kaban", keywords: ["mont", "kaban", "parka"] },
  { category: "Ceket", keywords: ["ceket"] },
  { category: "Yelek", keywords: ["yelek"] },
  { category: "Tulum", keywords: ["tulum"] },
  { category: "Tayt", keywords: ["tayt", "legging"] },
  { category: "Mayo & Bikini", keywords: ["mayo", "bikini"] },
  { category: "İç Giyim", keywords: ["sütyen", "külot"] },
  { category: "Pijama & Gecelik", keywords: ["pijama", "gecelik"] },
  { category: "Eşofman", keywords: ["eşofman", "jogger"] },
  { category: "Polo Yaka", keywords: ["polo yaka", "polo"] },
  { category: "Atlet", keywords: ["atlet"] },
  { category: "Boxer", keywords: ["boxer"] }
];

export function guessCategoryFromProductName(productName: string): string | null {
  const lower = productName.toLocaleLowerCase("tr-TR");
  for (const entry of PRODUCT_NAME_CATEGORY_KEYWORDS) {
    if (entry.keywords.some((k) => lower.includes(k))) return entry.category;
  }
  return null;
}

// KOD3 -> kategori icin normalize edilmis anahtar (CategoryKodMapping.kod3 bu formatta
// tutulur, CATEGORY_MAP anahtarlariyla ayni normalize kurali).
export function normalizeKod3(categoryRaw: string): string {
  return categoryRaw.trim().toUpperCase();
}

// Yoneticinin onizlemede onayladigi/elle girdigi bir KOD3->kategori eslemesi, ayni
// kod bir dahaki dosyada tekrar sorulmasin diye buradan ogrenilir (bkz.
// EXCEL_KATEGORI_ESLEME_PLANI.md bolum 6). Sabit CATEGORY_MAP'ten ONCE kontrol
// edilir, boylece yonetici CATEGORY_MAP'teki bir hatayi da kod deploy etmeden
// duzeltebilir.
export async function resolveLearnedCategoryName(tx: Tx, categoryRaw: string): Promise<string | null> {
  const kod3 = normalizeKod3(categoryRaw);
  if (!kod3) return null;
  const mapping = await tx.categoryKodMapping.findUnique({ where: { kod3 }, include: { category: true } });
  return mapping?.category.name ?? null;
}

// Kesin eslesme icin tam lookup sirasi: once ogrenilmis DB eslemesi, sonra sabit
// CATEGORY_MAP. Ikisi de yoksa null doner - cagiran taraf (onizleme route'u) bu
// durumda AI onerisine basvurur.
export async function detectCategoryName(tx: Tx, categoryRaw: string): Promise<string | null> {
  return (await resolveLearnedCategoryName(tx, categoryRaw)) ?? mapCategoryName(categoryRaw);
}

// Marka/kategori sayfalarında kullanılan Türkçe slug üretimiyle aynı kural.
export function slugifyTr(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9ığüşöç\s-]/gi, "")
    .replace(/\s+/g, "-");
}

function parseCents(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  const num = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(num)) return null;
  return Math.round(num * 100);
}

// RENK hücresi bazen "AÇIK İNDİGO/LGT" gibi isim+stok kodu birlikte gelir (kod kısmı
// gözlemlenen örneklerde hep kısa, örn. 3 karakter: LGT, MID, BLK, 303, 052...). Sadece
// isim kısmını al - Renk attribute değeri, SKU ve Koton görsel eşleştirmesi (bkz.
// EXCEL_URUN_AKTARIM_PLANI.md bölüm 4, orada Koton etiketleriyle birebir aynı yazım
// eşleşmesi bekleniyor) hep bu temiz isimle çalışmalı.
export function parseColorName(raw: string): string {
  const trimmed = raw.trim();
  const slashIndex = trimmed.lastIndexOf("/");
  if (slashIndex <= 0) return trimmed;
  const suffix = trimmed.slice(slashIndex + 1).trim();
  if (!suffix || suffix.length > 6) return trimmed; // gerçek bir kod gibi görünmüyorsa dokunma
  return trimmed.slice(0, slashIndex).trim();
}

export function parseExcelFile(buffer: ArrayBuffer | Buffer): ExcelParseResult {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return { rows: [], errors: [{ row: 0, message: "Excel dosyasında sayfa bulunamadı." }] };
  }
  const sheet = workbook.Sheets[sheetName];
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null });

  const rows: ExcelImportRow[] = [];
  const errors: ExcelParseError[] = [];
  const seenBarcodes = new Set<string>();

  rawRows.forEach((raw, index) => {
    const rowNumber = index + 2; // 1. satır başlık
    const productCode = String(raw["ÜRÜN KODU"] ?? "").trim();
    const productName = String(raw["ÜRÜN ADI"] ?? "").trim();
    const barcode = String(raw["BARKOD"] ?? "").trim();
    const colorRaw = String(raw["RENK"] ?? "").trim();
    const color = parseColorName(colorRaw);
    const size = String(raw["BEDEN"] ?? "").trim();
    const genderRaw = String(raw["KOD4"] ?? "").trim();
    const categoryRaw = String(raw["KOD3"] ?? "").trim();
    const brandName = String(raw["FIRMAADI"] ?? "").trim() || "Koton";

    if (!productCode) {
      errors.push({ row: rowNumber, message: "ÜRÜN KODU boş olamaz." });
      return;
    }
    if (!productName) {
      errors.push({ row: rowNumber, message: "ÜRÜN ADI boş olamaz." });
      return;
    }
    if (!barcode) {
      errors.push({ row: rowNumber, message: "BARKOD boş olamaz." });
      return;
    }
    if (seenBarcodes.has(barcode)) {
      errors.push({ row: rowNumber, message: `BARKOD tekrar ediyor, satır atlandı: ${barcode}` });
      return;
    }
    if (!colorRaw) {
      errors.push({ row: rowNumber, message: "RENK boş olamaz." });
      return;
    }
    if (!size) {
      errors.push({ row: rowNumber, message: "BEDEN boş olamaz." });
      return;
    }

    const priceCents = parseCents(raw["SFIYAT1"]);
    if (priceCents === null || priceCents <= 0) {
      errors.push({ row: rowNumber, message: "SFIYAT1 geçerli bir satış fiyatı olmalı." });
      return;
    }
    const costCents = parseCents(raw["AFIYATI"]);

    const stockNum = Number(raw["MİKTAR"]);
    const stock = Number.isFinite(stockNum) && stockNum > 0 ? Math.round(stockNum) : 0;

    seenBarcodes.add(barcode);
    rows.push({
      rowNumber,
      productCode,
      productName,
      barcode,
      genderRaw,
      categoryRaw,
      color,
      size,
      costCents,
      priceCents,
      stock,
      brandName
    });
  });

  return { rows, errors };
}

export interface ProductVariantRow {
  rowNumber: number;
  barcode: string;
  color: string;
  size: string;
  stock: number;
}

export interface ProductGroup {
  productCode: string;
  productName: string;
  genderRaw: string;
  categoryRaw: string;
  brandName: string;
  priceCents: number;
  costCents: number | null;
  colors: string[];
  variants: ProductVariantRow[];
}

// Satırları ÜRÜN KODU'na göre gruplar - ürün başına sabit alanlar (ad, fiyat, marka, ...)
// grubun ilk satırından alınır, diğer satırlar sadece varyant olarak eklenir.
export function groupExcelRows(rows: ExcelImportRow[]): ProductGroup[] {
  const map = new Map<string, ProductGroup>();
  for (const row of rows) {
    let group = map.get(row.productCode);
    if (!group) {
      group = {
        productCode: row.productCode,
        productName: row.productName,
        genderRaw: row.genderRaw,
        categoryRaw: row.categoryRaw,
        brandName: row.brandName,
        priceCents: row.priceCents,
        costCents: row.costCents,
        colors: [],
        variants: []
      };
      map.set(row.productCode, group);
    }
    if (!group.colors.includes(row.color)) group.colors.push(row.color);
    group.variants.push({
      rowNumber: row.rowNumber,
      barcode: row.barcode,
      color: row.color,
      size: row.size,
      stock: row.stock
    });
  }
  return Array.from(map.values());
}

async function resolveBrandId(tx: Tx, brandName: string): Promise<string | null> {
  const trimmed = brandName.trim();
  if (!trimmed) return null;
  const existing = await tx.brand.findFirst({ where: { name: { equals: trimmed, mode: "insensitive" } } });
  if (existing) return existing.id;
  const created = await tx.brand.create({ data: { name: trimmed, slug: slugifyTr(trimmed) } });
  return created.id;
}

export async function resolveCategoryIdByName(tx: Tx, categoryName: string): Promise<string | null> {
  const existing = await tx.category.findFirst({ where: { name: { equals: categoryName, mode: "insensitive" } } });
  return existing?.id ?? null;
}

async function generateUniqueCategorySlug(tx: Tx, name: string): Promise<string> {
  const base = slugifyTr(name) || "kategori";
  let candidate = base;
  let suffix = 2;
  while (await tx.category.findUnique({ where: { slug: candidate } })) {
    candidate = `${base}-${suffix}`;
    suffix++;
  }
  return candidate;
}

// Onizlemede yoneticinin onayladigi/elle yazdigi kategori adi DB'de yoksa, artik
// hata ile ice aktarimi durdurmuyoruz - resolveBrandId'deki (marka) davranisla ayni
// sekilde otomatik olusturuluyor (ust kategorisiz, tepe seviye). Yonetici zaten
// onizlemede o ismi kendi onayladigi/yazdigi icin (rastgele bir AI ciktisi
// otomatik yazilmiyor, bkz. category-suggest.ts) surpriz bir "cop kategori"
// riski tasimiyor.
export async function getOrCreateCategoryId(tx: Tx, categoryName: string): Promise<string | null> {
  const trimmed = categoryName.trim();
  if (!trimmed) return null;
  const existingId = await resolveCategoryIdByName(tx, trimmed);
  if (existingId) return existingId;
  const created = await tx.category.create({
    data: { name: trimmed, slug: await generateUniqueCategorySlug(tx, trimmed) }
  });
  return created.id;
}

async function generateUniqueSlug(tx: Tx, name: string): Promise<string> {
  const base = slugifyTr(name) || "urun";
  let candidate = base;
  let suffix = 2;
  while (await tx.product.findUnique({ where: { slug: candidate } })) {
    candidate = `${base}-${suffix}`;
    suffix++;
  }
  return candidate;
}

// Koton görsel eşleştirmesi (Faz C) sadece bu importla YENİ oluşturulan ürünler için
// çalışır - mevcut ürünün fotoğrafı/açıklaması zaten varsa dokunulmaz (plan bölüm 1).
export interface KotonEnrichmentTarget {
  productId: string;
  productCode: string;
  productName: string;
  firstBarcode: string;
  colorValueIdByLabel: Record<string, string>;
}

export interface ImportSummary {
  productsCreated: number;
  productsUpdated: number;
  variantsCreated: number;
  variantsUpdated: number;
  newProductTargets: KotonEnrichmentTarget[];
}

// categoryIdByProductCode: her grup icin ONCEDEN cozulmus, kesin kategori id'si
// (ya da null - kategorisiz). Onizlemede yoneticinin onayladigi/duzelttigi deger,
// eslesmeyenler icin fallback kategori, o da yoksa null - oncelik sirasi cagiran
// route'ta (excel-aktar) belirlenir, bu fonksiyon sadece uygular.
export async function importProductGroups(
  groups: ProductGroup[],
  categoryIdByProductCode: Map<string, string | null>
): Promise<ImportSummary> {
  const allBarcodes = groups.flatMap((g) => g.variants.map((v) => v.barcode));
  const existingVariants = allBarcodes.length
    ? await prisma.productVariant.findMany({
        where: { barcode: { in: allBarcodes } },
        select: { id: true, barcode: true, productId: true }
      })
    : [];
  const existingByBarcode = new Map(existingVariants.map((v) => [v.barcode as string, v]));

  const groupIsNew = new Map<string, boolean>();
  for (const group of groups) {
    const matched = group.variants.some((v) => existingByBarcode.has(v.barcode));
    groupIsNew.set(group.productCode, !matched);
  }

  // Renk/Beden değer id'leri, marka id'si ve slug'lar transaction AÇILMADAN ÖNCE
  // çözülür - Neon'un pooled bağlantısındaki ağ gecikmesiyle bir interactive
  // transaction içinde onlarca sıralı sorgu atmak zaman aşımına (P2028) yol açıyor.
  // Transaction içinde sadece asıl yazma sorguları (product/variant upsert) kalır.
  const valueIdCache = new Map<string, string>();
  const uniquePairs = new Map<string, { attributeName: string; value: string }>();
  for (const group of groups) {
    for (const variant of group.variants) {
      uniquePairs.set(`Renk::${variant.color}`, { attributeName: "Renk", value: variant.color });
      uniquePairs.set(`Beden::${variant.size}`, { attributeName: "Beden", value: variant.size });
    }
  }
  for (const pair of uniquePairs.values()) {
    const [id] = await resolveOptionValueIds(prisma, [pair]);
    if (id) valueIdCache.set(`${pair.attributeName}::${pair.value}`, id);
  }

  const brandIdByProductCode = new Map<string, string | null>();
  const slugByProductCode = new Map<string, string>();
  for (const group of groups) {
    if (!groupIsNew.get(group.productCode)) continue;
    brandIdByProductCode.set(group.productCode, await resolveBrandId(prisma, group.brandName));
    slugByProductCode.set(group.productCode, await generateUniqueSlug(prisma, group.productName));
  }

  const summary: ImportSummary = {
    productsCreated: 0,
    productsUpdated: 0,
    variantsCreated: 0,
    variantsUpdated: 0,
    newProductTargets: []
  };

  await prisma.$transaction(
    async (tx) => {
      for (const group of groups) {
        const matchedExisting = group.variants
          .map((v) => existingByBarcode.get(v.barcode))
          .find((v): v is NonNullable<typeof v> => !!v);

        let productId: string;
        const isNew = !matchedExisting;

        if (matchedExisting) {
          await tx.product.update({
            where: { id: matchedExisting.productId },
            data: { priceCents: group.priceCents, costCents: group.costCents, code: group.productCode }
          });
          productId = matchedExisting.productId;
          summary.productsUpdated++;
        } else {
          const created = await tx.product.create({
            data: {
              name: group.productName,
              slug: slugByProductCode.get(group.productCode)!,
              code: group.productCode,
              description: `${group.productName}. Detaylı ürün açıklaması yakında eklenecek.`,
              priceCents: group.priceCents,
              costCents: group.costCents,
              status: "DRAFT",
              categoryId: categoryIdByProductCode.get(group.productCode) ?? null,
              brandId: brandIdByProductCode.get(group.productCode) ?? null,
              gender: mapGender(group.genderRaw)
            }
          });
          productId = created.id;
          summary.productsCreated++;
        }

        const colorValueIdByLabel: Record<string, string> = {};

        for (const variant of group.variants) {
          const colorValueId = valueIdCache.get(`Renk::${variant.color}`) ?? null;
          const sizeValueId = valueIdCache.get(`Beden::${variant.size}`) ?? null;
          if (colorValueId) colorValueIdByLabel[variant.color] = colorValueId;

          const optionValueIds = [colorValueId, sizeValueId].filter((id): id is string => !!id);
          const existing = existingByBarcode.get(variant.barcode);

          if (existing) {
            await tx.productVariant.update({
              where: { id: existing.id },
              data: { stock: variant.stock }
            });
            summary.variantsUpdated++;
          } else {
            const sku = `${group.productCode}-${variant.color.replace(/\s+/g, "-")}-${variant.size}`;
            await tx.productVariant.create({
              data: {
                productId,
                sku,
                barcode: variant.barcode,
                stock: variant.stock,
                options: { create: optionValueIds.map((valueId) => ({ valueId })) }
              }
            });
            summary.variantsCreated++;
          }
        }

        if (isNew) {
          summary.newProductTargets.push({
            productId,
            productCode: group.productCode,
            productName: group.productName,
            firstBarcode: group.variants[0].barcode,
            colorValueIdByLabel
          });
        }
      }
    },
    { timeout: 30000 }
  );

  return summary;
}
