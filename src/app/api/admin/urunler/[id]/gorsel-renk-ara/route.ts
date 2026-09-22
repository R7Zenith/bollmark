import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { enrichOne } from "@/lib/koton-images";
import { enrichOneSlazenger } from "@/lib/slazenger-images";
import { resolveImageSourceForBrand } from "@/lib/brand-image-sources";

export const maxDuration = 30;

// Ürün düzenleme sayfasındaki "Renk Görselleri" bölümünde, gorseli olmayan tek bir
// renk icin "Bu renk için Koton'da ara" butonu için: `gorsel-yenile` route'undaki
// `enrichOne` mantığini aynen kullanir, sadece hedefteki `colorValueIdByLabel`
// haritasini tek bir renge daraltir - boylece Koton'dan sadece o rengin
// gorselleri cekilir, digerlerine dokunulmaz.
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Yetkisiz istek." }, { status: 401 });
  if (session.user?.role !== "ADMIN") return NextResponse.json({ error: "Bu işlem için yetkiniz yok." }, { status: 403 });

  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const valueId = typeof body?.valueId === "string" ? body.valueId : "";
  if (!valueId) return NextResponse.json({ error: "Renk değeri belirtilmedi." }, { status: 400 });

  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      brand: true,
      variants: { include: { options: { include: { value: { include: { attribute: true } } } } } }
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

  let colorLabel: string | null = null;
  for (const variant of product.variants) {
    for (const opt of variant.options) {
      if (opt.value.attribute.isColor && opt.value.id === valueId) {
        colorLabel = opt.value.value;
      }
    }
  }
  if (!colorLabel) {
    return NextResponse.json({ error: "Bu renk, ürünün varyantları arasında bulunamadı." }, { status: 400 });
  }

  const target = {
    productId: product.id,
    productCode: product.code,
    productName: product.name,
    firstBarcode,
    colorValueIdByLabel: { [colorLabel]: valueId },
    imageSourceBaseUrl: imageSource?.baseUrl ?? null,
    imageSourceDisplayName: imageSource?.displayName ?? null,
    imageSourceStrategy: imageSource?.strategy ?? null
  };
  const result =
    imageSource?.strategy === "slazenger-arama"
      ? await enrichOneSlazenger(target, { overwriteDescription: false })
      : await enrichOne(target, { overwriteDescription: false });

  return NextResponse.json(result);
}
