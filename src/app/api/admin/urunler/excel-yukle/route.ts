import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { parseExcelFile, groupExcelRows, mapGender } from "@/lib/excel-import";

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

  const groups = groupExcelRows(parsed.rows).map((g) => ({
    productCode: g.productCode,
    productName: g.productName,
    gender: mapGender(g.genderRaw),
    brandName: g.brandName,
    priceCents: g.priceCents,
    costCents: g.costCents,
    colors: g.colors,
    variantCount: g.variants.length,
    totalStock: g.variants.reduce((sum, v) => sum + v.stock, 0)
  }));

  return NextResponse.json({
    rows: parsed.rows,
    errors: parsed.errors,
    groups,
    totalVariants: parsed.rows.length,
    totalStock: parsed.rows.reduce((sum, r) => sum + r.stock, 0)
  });
}
