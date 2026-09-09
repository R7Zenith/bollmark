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

  // Kesin eslesme icin once ogrenilmis DB eslemesi, sonra sabit CATEGORY_MAP kontrol
  // edilir (detectCategoryName, bkz. excel-import.ts). Ikisi de yoksa her benzersiz
  // KOD3 degeri icin bir kez AI onerisi istenir (ayni deger birden fazla grupta
  // gecebilir, tekrar sorulmaz) - bu KESIN bir eslesme degil, sadece onizlemede
  // yoneticinin onaylamasi/duzeltmesi icin bir oneri (bkz. EXCEL_KATEGORI_ESLEME_PLANI.md
  // bolum 2 ve 6).
  const existingCategoryNames = (await prisma.category.findMany({ select: { name: true } })).map((c) => c.name);
  const detectedCache = new Map<string, string | null>();
  for (const g of rawGroups) {
    const key = normalizeKod3(g.categoryRaw);
    if (!key || detectedCache.has(key)) continue;
    detectedCache.set(key, await detectCategoryName(prisma, g.categoryRaw));
  }
  // KOD3 kesin eşleşmezse, AI'ya gitmeden önce ürün adında geçen anahtar kelimeye
  // bakarak ücretsiz/deterministik bir tahmin denenir (bkz. excel-import.ts,
  // guessCategoryFromProductName). Bu, KOD3'e değil ÜRÜN KODU'na göre - çünkü aynı
  // KOD3 altında farklı ürün adları olabilir.
  const nameGuessCache = new Map<string, string | null>();
  for (const g of rawGroups) {
    const key = normalizeKod3(g.categoryRaw);
    if (key && detectedCache.get(key)) continue;
    nameGuessCache.set(g.productCode, guessCategoryFromProductName(g.productName));
  }

  const suggestionCache = new Map<string, CategorySuggestion | null>();
  for (const g of rawGroups) {
    const key = normalizeKod3(g.categoryRaw);
    if (!key || detectedCache.get(key)) continue;
    if (nameGuessCache.get(g.productCode)) continue; // isimden tahmin başarılıysa AI'ya gitme
    if (suggestionCache.has(key)) continue;
    suggestionCache.set(key, await suggestCategory(g.categoryRaw, existingCategoryNames));
  }

  const groups = rawGroups.map((g) => {
    const key = normalizeKod3(g.categoryRaw);
    const detectedCategory = detectedCache.get(key) ?? null;
    const nameGuessedCategory = detectedCategory ? null : nameGuessCache.get(g.productCode) ?? null;
    const suggestedCategory = detectedCategory || nameGuessedCategory ? null : suggestionCache.get(key) ?? null;
    return {
      productCode: g.productCode,
      productName: g.productName,
      gender: mapGender(g.genderRaw),
      categoryRaw: g.categoryRaw,
      detectedCategory,
      nameGuessedCategory,
      suggestedCategory,
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
