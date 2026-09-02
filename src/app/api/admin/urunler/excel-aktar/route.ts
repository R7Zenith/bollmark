import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { groupExcelRows, importProductGroups, type ExcelImportRow } from "@/lib/excel-import";
import { enrichProductsFromKoton } from "@/lib/koton-images";

function isValidRow(v: unknown): v is ExcelImportRow {
  if (typeof v !== "object" || v === null) return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r.rowNumber === "number" &&
    typeof r.productCode === "string" &&
    typeof r.productName === "string" &&
    typeof r.barcode === "string" &&
    typeof r.genderRaw === "string" &&
    typeof r.color === "string" &&
    typeof r.size === "string" &&
    (r.costCents === null || typeof r.costCents === "number") &&
    typeof r.priceCents === "number" &&
    typeof r.stock === "number" &&
    typeof r.brandName === "string"
  );
}

// Önizleme adımında (/api/admin/urunler/excel-yukle) ayrıştırılan satırları alıp gerçek
// ürün/varyant upsert'ini yapar, ardından yeni oluşturulan ürünler için sırayla Koton
// görsel/açıklama eşleştirmesini çalıştırır.
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

  let categoryId: string | null = typeof body?.categoryId === "string" && body.categoryId ? body.categoryId : null;
  if (categoryId) {
    const category = await prisma.category.findUnique({ where: { id: categoryId } });
    if (!category) categoryId = null;
  }

  const groups = groupExcelRows(rows);

  let summary;
  try {
    summary = await importProductGroups(groups, categoryId);
  } catch (error) {
    console.error("Excel içe aktarımı başarısız:", error);
    return NextResponse.json({ error: "İçe aktarım sırasında bir hata oluştu, hiçbir değişiklik kaydedilmedi." }, { status: 500 });
  }

  const kotonResults = await enrichProductsFromKoton(summary.newProductTargets);

  return NextResponse.json({
    productsCreated: summary.productsCreated,
    productsUpdated: summary.productsUpdated,
    variantsCreated: summary.variantsCreated,
    variantsUpdated: summary.variantsUpdated,
    kotonResults: kotonResults.map((r) => ({
      productId: r.productId,
      productCode: r.productCode,
      found: r.found,
      imagesAdded: r.imagesAdded,
      descriptionUpdated: r.descriptionUpdated
    }))
  });
}
