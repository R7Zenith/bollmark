import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  parseExcelFile,
  groupExcelRows,
  mapGender,
  detectCategoryName,
  normalizeKod3,
  guessCategoryFromProductName
} from "@/lib/excel-import";
import { suggestCategory, type CategorySuggestion } from "@/lib/category-suggest";
import { normalizeSeason } from "@/lib/seasons";

// Excel dosyasını ayrıştırıp önizleme döner - hiçbir veritabanı yazma işlemi yapmaz.
// Gerçek aktarım /api/admin/urunler/excel-aktar'da, burada dönen `rows` listesi
// istemciden geri gönderilerek yapılır.
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Yetkisiz istek." }, { status: 401 });
  }
  if (session.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Bu işlem için yetkiniz yok." }, { status: 403 });
  }

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "Dosya bulunamadı." }, { status: 400 });
  }
  if (!/\.(xls|xlsx)$/i.test(file.name)) {
    return NextResponse.json({ error: "Sadece .xls veya .xlsx dosyası yükleyebilirsiniz." }, { status: 400 });
  }

  let buffer: Buffer;
  try {
    buffer = Buffer.from(await file.arrayBuffer());
  } catch {
    return NextResponse.json({ error: "Dosya okunamadı." }, { status: 400 });
  }

  let parsed;
  try {
    parsed = parseExcelFile(buffer);
  } catch {
    return NextResponse.json({ error: "Excel dosyası ayrıştırılamadı, dosya bozuk olabilir." }, { status: 400 });
  }

  const rawGroups = groupExcelRows(parsed.rows);

  // Kategori onceligi URUN (productCode) bazinda: 1) urun adindan guclu tahmin (sadece
  // DB'de var olan kategori adlariyla), 2) sabit CATEGORY_MAP (KOD3), 3) ogrenilmis
  // CategoryKodMapping (yedek), 4) AI onerisi (prompta urun adi da girer). Koton KOD3'u
  // urun tipini guvenilir ayirmadigi icin urun adi KOD3'ten once gelir (bkz.
  // EXCEL_KATEGORI_YANLIS_ESLESME_PLANI.md). Ad tahmini ile KOD3 sonucu farkliysa KOD3
  // sonucu conflictCategory olarak doner, onizlemede uyari gosterilir. AI KESIN bir
  // eslesme degil, sadece yoneticinin onaylamasi/duzeltmesi icin bir oneri.
  const existingCategoryNames = (await prisma.category.findMany({ select: { name: true } })).map((c) => c.name);
  const kodCategoryCache = new Map<string, string | null>();
  for (const g of rawGroups) {
    const key = normalizeKod3(g.categoryRaw);
    if (!key || kodCategoryCache.has(key)) continue;
    kodCategoryCache.set(key, await detectCategoryName(prisma, g.categoryRaw));
  }

  const suggestionByProductCode = new Map<string, CategorySuggestion | null>();
  const resolved = new Map<
    string,
    { detectedCategory: string | null; detectedFrom: "name" | "kod" | null; conflictCategory: string | null }
  >();
  for (const g of rawGroups) {
    const nameGuess = guessCategoryFromProductName(g.productName, existingCategoryNames);
    const kodCategory = kodCategoryCache.get(normalizeKod3(g.categoryRaw)) ?? null;
    if (nameGuess) {
      const conflicts = !!kodCategory && kodCategory.toLocaleLowerCase("tr-TR") !== nameGuess.toLocaleLowerCase("tr-TR");
      resolved.set(g.productCode, {
        detectedCategory: nameGuess,
        detectedFrom: "name",
        conflictCategory: conflicts ? kodCategory : null
      });
      continue;
    }
    if (kodCategory) {
      resolved.set(g.productCode, { detectedCategory: kodCategory, detectedFrom: "kod", conflictCategory: null });
      continue;
    }
    resolved.set(g.productCode, { detectedCategory: null, detectedFrom: null, conflictCategory: null });
    if (normalizeKod3(g.categoryRaw)) {
      suggestionByProductCode.set(g.productCode, await suggestCategory(g.categoryRaw, g.productName, existingCategoryNames));
    }
  }

  const groups = rawGroups.map((g) => {
    const { detectedCategory, detectedFrom, conflictCategory } = resolved.get(g.productCode)!;
    const suggestedCategory = detectedCategory ? null : suggestionByProductCode.get(g.productCode) ?? null;
    const season = normalizeSeason(g.seasonRaw);
    return {
      productCode: g.productCode,
      productName: g.productName,
      gender: mapGender(g.genderRaw),
      categoryRaw: g.categoryRaw,
      detectedCategory,
      detectedFrom,
      conflictCategory,
      suggestedCategory,
      // KOD6 - onizlemede "Sezon" sutunu; taninmayan deger ham haliyle
      // aktarilir, seasonRecognized:false ile uyari gosterilir.
      season: season?.name ?? null,
      seasonRecognized: season?.recognized ?? true,
      brandName: g.brandName,
      priceCents: g.priceCents,
      costCents: g.costCents,
      colors: g.colors,
      variantCount: g.variants.length,
      totalStock: g.variants.reduce((sum, v) => sum + v.stock, 0)
    };
  });

  return NextResponse.json({
    rows: parsed.rows,
    errors: parsed.errors,
    groups,
    totalVariants: parsed.rows.length,
    totalStock: parsed.rows.reduce((sum, r) => sum + r.stock, 0)
  });
}
