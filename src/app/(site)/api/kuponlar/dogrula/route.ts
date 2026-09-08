import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { validateCoupon, type CouponLine } from "@/lib/coupons";
import { effectivePrice } from "@/lib/variant";

const lineSchema = z.object({
  productId: z.string(),
  variantId: z.string(),
  quantity: z.number().int().positive()
});

const schema = z.object({
  code: z.string().min(1),
  lines: z.array(lineSchema).min(1)
});

// Sepet/odeme sayfasinda "Uygula" butonuna anlik geri bildirim vermek icin -
// indirimi UYGULAMAZ, sadece hesaplayip gosterir. Baglayici/nihai hesaplama
// siparis olusturulurken orders/route.ts icinde tekrar yapilir. Fiyat ve
// kategori/marka bilgisi orders/route.ts ile ayni prensiple istemciden gelen
// degere guvenilmeden burada sunucuda urun/varyant kaydindan okunur.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ valid: false, message: "Geçersiz istek." }, { status: 400 });
  }

  const productIds = [...new Set(parsed.data.lines.map((l) => l.productId))];
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    include: { variants: true }
  });
  const productById = new Map(products.map((p) => [p.id, p]));

  const lines: CouponLine[] = [];
  for (const line of parsed.data.lines) {
    const product = productById.get(line.productId);
    const variant = product?.variants.find((v) => v.id === line.variantId);
    if (!product || !variant) {
      return NextResponse.json({ valid: false, message: "Sepetteki bir ürün veya varyant artık mevcut değil." });
    }
    lines.push({
      productId: line.productId,
      priceCents: effectivePrice(product, variant),
      quantity: line.quantity,
      categoryId: product.categoryId,
      brandId: product.brandId
    });
  }

  const result = await validateCoupon(prisma, parsed.data.code, lines);
  if (!result.valid) {
    return NextResponse.json({ valid: false, message: result.message });
  }
  return NextResponse.json({
    valid: true,
    discountCents: result.discountCents,
    freeShipping: result.freeShipping,
    message: "Kupon uygulandı."
  });
}
