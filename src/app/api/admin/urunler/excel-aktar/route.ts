import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  groupExcelRows,
  importProductGroups,
  getOrCreateCategoryId,
  normalizeKod3,
  type ExcelImportRow
} from "@/lib/excel-import";

export const maxDuration = 60;

function isValidRow(v: unknown): v is ExcelImportRow {
  if (typeof v !== "object" || v === null) return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r.rowNumber === "number" &&
    typeof r.productCode === "string" &&
    typeof r.productName === "string" &&
    typeof r.barcode === "string" &&
    typeof r.genderRaw === "string" &&
    typeof r.categoryRaw === "string" &&
    typeof r.color === "string" &&
    typeof r.size === "string" &&
    (r.costCents === null || typeof r.costCents === "number") &&
    typeof r.priceCents === "number" &&
    typeof r.stock === "number" &&
    typeof r.brandName === "string"
  );
}

// Önizleme adımında (/api/admin/urunler/excel-yukle) ayrıştırılan satırları alıp gerçek
// ürün/varyant upsert'ini yapar. Koton görsel/açıklama eşleştirmesi burada YAPILMAZ -
// istemci, yanıttaki newProductTargets üzerinde ürün başına ayrı bir istekle
// /excel-aktar/gorsel-getir'i çağırır (bkz. EXCEL_BUYUK_LISTE_TIMEOUT_VE_ILERLEME_PLANI.md).
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Yetkisiz istek." }, { status: 401 });
  }
  if (session.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Bu işlem için yetkiniz yok." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const rawRows: unknown[] = Array.isArray(body?.rows) ? body.rows : [];
  const rows = rawRows.filter(isValidRow);
  if (rows.length === 0) {
    return NextResponse.json({ error: "Aktarılacak satır bulunamadı." }, { status: 400 });
  }

  let fallbackCategoryId: string | null =
    typeof body?.categoryId === "string" && body.categoryId ? body.categoryId : null;
  if (fallbackCategoryId) {
    const category = await prisma.category.findUnique({ where: { id: fallbackCategoryId } });
    if (!category) fallbackCategoryId = null;
  }

  // Onizlemede her satir icin gosterilen kutucuktan gelen degerler (kesin eslesme,
  // AI onerisi ya da yoneticinin elle yazdigi isim - hepsi ayni sekilde davranir):
  // productCode -> serbest metin kategori adi. Bos birakilan/gonderilmeyen satirlar
  // fallbackCategoryId'ye duser (bkz. EXCEL_KATEGORI_ESLEME_PLANI.md bolum 3).
  const rawOverrides = body?.categoryOverrides;
  const categoryOverrides: Record<string, string> =
    rawOverrides && typeof rawOverrides === "object" && !Array.isArray(rawOverrides) ? rawOverrides : {};

  const groups = groupExcelRows(rows);

  // Yoneticinin onizlemede onayladigi/elle yazdigi kategori adi DB'de yoksa artik
  // hata ile durdurmuyoruz - otomatik olusturuluyor (bkz. getOrCreateCategoryId,
  // marka icin resolveBrandId ile ayni pattern). Ayni isim birden fazla satirda
  // gecebilecegi icin benzersizlestirilip tek seferde cozuluyor/olusturuluyor.
  const distinctOverrideNames = new Set(
    groups
      .map((g) => (typeof categoryOverrides[g.productCode] === "string" ? categoryOverrides[g.productCode].trim() : ""))
      .filter((name) => name.length > 0)
  );
  const categoryIdByName = new Map<string, string | null>();
  for (const name of distinctOverrideNames) {
    categoryIdByName.set(name, await getOrCreateCategoryId(prisma, name));
  }

  const categoryIdByProductCode = new Map<string, string | null>();
  for (const group of groups) {
    const override = typeof categoryOverrides[group.productCode] === "string" ? categoryOverrides[group.productCode].trim() : "";
    categoryIdByProductCode.set(group.productCode, override ? categoryIdByName.get(override) ?? null : fallbackCategoryId);
  }

  let summary;
  try {
    summary = await importProductGroups(groups, categoryIdByProductCode);
  } catch (error) {
    console.error("Excel içe aktarımı başarısız:", error);
    const detail = error instanceof Error ? error.message.slice(0, 300) : String(error).slice(0, 300);
    return NextResponse.json(
      { error: "İçe aktarım sırasında bir hata oluştu, hiçbir değişiklik kaydedilmedi.", detail },
      { status: 500 }
    );
  }

  // Yoneticinin bu ice aktarimda onayladigi/elle girdigi kategori eslemelerini kalici
  // hale getir - bir dahaki dosyada ayni KOD3 tekrar sorulmasin/bos gelmesin (bkz.
  // EXCEL_KATEGORI_ESLEME_PLANI.md bolum 6). Sadece yoneticinin GERCEKTEN bir isim
  // girdigi satirlar ogrenilir - bos birakilip fallback kategoriye dusen satirlar
  // ogrenilmez, aksi halde rastgele bir KOD3 degeri fallback'e kalici olarak baglanir.
  // Ogrenme basarisiz olursa (DB hatasi vb.) asil ice aktarim sonucunu ASLA etkilemez.
  const learnedByKod3 = new Map<string, string>();
  for (const group of groups) {
    const override = typeof categoryOverrides[group.productCode] === "string" ? categoryOverrides[group.productCode].trim() : "";
    const kod3 = normalizeKod3(group.categoryRaw);
    if (!override || !kod3) continue;
    const categoryId = categoryIdByName.get(override);
    if (!categoryId) continue;
    learnedByKod3.set(kod3, categoryId);
  }
  await Promise.all(
    Array.from(learnedByKod3.entries()).map(([kod3, categoryId]) =>
      prisma.categoryKodMapping
        .upsert({ where: { kod3 }, create: { kod3, categoryId }, update: { categoryId } })
        .catch((error) => console.error("Kategori eşlemesi öğrenilemedi (yoksayıldı):", error))
    )
  );

  return NextResponse.json({
    productsCreated: summary.productsCreated,
    productsUpdated: summary.productsUpdated,
    variantsCreated: summary.variantsCreated,
    variantsUpdated: summary.variantsUpdated,
    newProductTargets: summary.newProductTargets
  });
}
