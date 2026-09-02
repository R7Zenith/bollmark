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
// eşleşmeyen değerler boş bırakılır (bkz. plan bölüm 3).
const GENDER_MAP: Record<string, string> = {
  MEN: "Erkek",
  ERKEK: "Erkek",
  WOMEN: "Kadın",
  KADIN: "Kadın",
  KIDS: "Çocuk",
  COCUK: "Çocuk",
  ÇOCUK: "Çocuk",
  UNISEX: "Unisex"
};

export function mapGender(genderRaw: string): string | null {
  return GENDER_MAP[genderRaw.trim().toUpperCase()] ?? null;
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
    const color = String(raw["RENK"] ?? "").trim();
    const size = String(raw["BEDEN"] ?? "").trim();
    const genderRaw = String(raw["KOD4"] ?? "").trim();
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
    if (!color) {
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

export async function importProductGroups(
  groups: ProductGroup[],
  categoryId: string | null
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
            data: { priceCents: group.priceCents, costCents: group.costCents }
          });
          productId = matchedExisting.productId;
          summary.productsUpdated++;
        } else {
          const created = await tx.product.create({
            data: {
              name: group.productName,
              slug: slugByProductCode.get(group.productCode)!,
              description: `${group.productName}. Detaylı ürün açıklaması yakında eklenecek.`,
              priceCents: group.priceCents,
              costCents: group.costCents,
              status: "DRAFT",
              categoryId: categoryId || null,
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
