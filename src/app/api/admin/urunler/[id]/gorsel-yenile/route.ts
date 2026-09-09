import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { enrichOne } from "@/lib/koton-images";

export const maxDuration = 30;

// Ürünler sayfasındaki "Fotoğrafları yeniden ara" butonu için: tek bir ürünü
// mevcut kod/barkod/renk verisiyle Koton'da yeniden arar. Excel aktarımındaki
// enrichOne ile aynı mekanizmayı kullanır (bkz. EXCEL_KOTON_GORSEL_ARAMA_TAKILIYOR_PLANI.md).
// Buton, elle düzenlenmiş olabilecek mevcut ürünlere karşı tıklanacağı için
// açıklamanın üzerine yazılmaz - sadece görseller eklenir.
export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Yetkisiz istek." }, { status: 401 });
  if (session.user?.role !== "ADMIN") return NextResponse.json({ error: "Bu işlem için yetkiniz yok." }, { status: 403 });

  const { id } = await context.params;
  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      variants: { include: { options: { include: { value: { include: { attribute: true } } } } } }
    }
  });
  if (!product) return NextResponse.json({ error: "Ürün bulunamadı." }, { status: 404 });
  if (!product.code) {
    return NextResponse.json({ error: "Bu ürünün ürün kodu kayıtlı değil, Koton'da aranamaz." }, { status: 400 });
  }
  const firstBarcode = product.variants.find((v) => v.barcode)?.barcode ?? null;
  if (!firstBarcode) {
    return NextResponse.json({ error: "Bu ürünün barkodlu bir varyantı yok." }, { status: 400 });
  }

  const colorValueIdByLabel: Record<string, string> = {};
  for (const variant of product.variants) {
    for (const opt of variant.options) {
      if (opt.value.attribute.name === "Renk") {
        colorValueIdByLabel[opt.value.value] = opt.value.id;
      }
    }
  }

  const result = await enrichOne(
    {
      productId: product.id,
      productCode: product.code,
      productName: product.name,
      firstBarcode,
      colorValueIdByLabel
    },
    { overwriteDescription: false }
  );

  return NextResponse.json(result);
}
