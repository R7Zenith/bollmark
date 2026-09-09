import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { enrichFromUrl } from "@/lib/koton-images";

export const maxDuration = 30;

// Ürünler sayfasındaki "Koton linkiyle ekle" butonu için: otomatik arama (autocomplete/
// list) hiçbir sonuç vermeyen ürünlerde (bkz. DEPLOY_STATUS.md - arama indeksinden
// tamamen düşmüş ürünler) admin, koton.com'da elle bulduğu ürün sayfasının linkini
// yapıştırabiliyor. Arama adımı tamamen atlanıp doğrudan bu URL'den ürün verisi
// (renk bazlı görseller + açıklama) çekiliyor - `gorsel-yenile` route'undaki
// `enrichOne` ile aynı `enrichFromUrl` mantığını kullanır, sadece kaynak farklı.
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Yetkisiz istek." }, { status: 401 });
  if (session.user?.role !== "ADMIN") return NextResponse.json({ error: "Bu işlem için yetkiniz yok." }, { status: 403 });

  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const url = typeof body?.url === "string" ? body.url.trim() : "";
  if (!url) return NextResponse.json({ error: "Bir Koton ürün sayfası linki girin." }, { status: 400 });
  if (!/^https:\/\/(www\.)?koton\.com\//i.test(url)) {
    return NextResponse.json({ error: "Bu bir koton.com ürün linki gibi görünmüyor." }, { status: 400 });
  }

  const product = await prisma.product.findUnique({
    where: { id },
    include: { variants: { include: { options: { include: { value: { include: { attribute: true } } } } } } }
  });
  if (!product) return NextResponse.json({ error: "Ürün bulunamadı." }, { status: 404 });
  if (!product.code) {
    return NextResponse.json({ error: "Bu ürünün ürün kodu kayıtlı değil." }, { status: 400 });
  }

  const colorValueIdByLabel: Record<string, string> = {};
  for (const variant of product.variants) {
    for (const opt of variant.options) {
      if (opt.value.attribute.name === "Renk") {
        colorValueIdByLabel[opt.value.value] = opt.value.id;
      }
    }
  }
  if (Object.keys(colorValueIdByLabel).length === 0) {
    return NextResponse.json({ error: "Bu ürünün renk varyantı yok, otomatik eşleştirme yapılamıyor." }, { status: 400 });
  }

  const result = await enrichFromUrl(
    {
      productId: product.id,
      productCode: product.code,
      productName: product.name,
      firstBarcode: product.variants.find((v) => v.barcode)?.barcode ?? "",
      colorValueIdByLabel
    },
    url,
    { overwriteDescription: false }
  );

  return NextResponse.json(result);
}
