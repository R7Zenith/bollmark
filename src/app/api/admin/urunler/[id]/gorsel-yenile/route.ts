import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { enrichOne } from "@/lib/koton-images";
import { enrichOneSlazenger } from "@/lib/slazenger-images";
import { resolveImageSourceForBrand } from "@/lib/brand-image-sources";
import { revalidateCatalog } from "@/lib/revalidate-catalog";

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
      brand: true,
      variants: { include: { options: { include: { value: { include: { attribute: true } } } } } },
      optionImages: { select: { valueId: true } }
    }
  });
  if (!product) return NextResponse.json({ error: "Ürün bulunamadı." }, { status: 404 });
  if (!product.code) {
    return NextResponse.json({ error: "Bu ürünün ürün kodu kayıtlı değil, otomatik aranamaz." }, { status: 400 });
  }
  const imageSource = resolveImageSourceForBrand(product.brand?.name);
  const firstBarcode = product.variants.find((v) => v.barcode)?.barcode ?? null;
  if (!firstBarcode) {
    return NextResponse.json({ error: "Bu ürünün barkodlu bir varyantı yok." }, { status: 400 });
  }

  // Sadece hic gorseli olmayan renkler icin arama yapiliyor - aksi halde zaten
  // fotografi olan renkler icin de Koton'dan ayni gorseller tekrar cekilip
  // ustune eklenir (duplike gorsel), bkz. kullanicidan gelen geri bildirim.
  const valueIdsWithImage = new Set(product.optionImages.map((img) => img.valueId));
  const colorValueIdByLabel: Record<string, string> = {};
  for (const variant of product.variants) {
    for (const opt of variant.options) {
      if (opt.value.attribute.name === "Renk" && !valueIdsWithImage.has(opt.value.id)) {
        colorValueIdByLabel[opt.value.value] = opt.value.id;
      }
    }
  }
  if (Object.keys(colorValueIdByLabel).length === 0) {
    return NextResponse.json({
      productId: product.id,
      productCode: product.code,
      found: true,
      imagesAdded: 0,
      descriptionUpdated: false,
      missingColors: []
    });
  }

  const target = {
    productId: product.id,
    productCode: product.code,
    productName: product.name,
    firstBarcode,
    colorValueIdByLabel,
    imageSourceBaseUrl: imageSource?.baseUrl ?? null,
    imageSourceDisplayName: imageSource?.displayName ?? null,
    imageSourceStrategy: imageSource?.strategy ?? null
  };
  const result =
    imageSource?.strategy === "slazenger-arama"
      ? await enrichOneSlazenger(target, { overwriteDescription: false })
      : await enrichOne(target, { overwriteDescription: false });

  if (result.imagesAdded > 0 || result.descriptionUpdated) revalidateCatalog(product.slug);
  return NextResponse.json(result);
}
