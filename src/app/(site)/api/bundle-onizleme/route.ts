import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { resolveBundleDiscount } from "@/lib/bundles";

const schema = z.object({
  lines: z.array(
    z.object({
      productId: z.string(),
      priceCents: z.number().int().nonnegative(),
      quantity: z.number().int().positive()
    })
  )
});

// CouponField'daki "ONIZLEME amaclidir, baglayici degildir" ile ayni prensip -
// sepet/odeme sayfalarinda anlik gosterim icin, istemcinin bildigi fiyatlarla
// hesaplanir. Nihai/gecerli tutar siparis olusturulurken orders/route.ts
// icinde urun/varyant fiyati DB'den yeniden okunarak hesaplanir.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ discountCents: 0 });
  }

  const { discountCents } = await resolveBundleDiscount(prisma, parsed.data.lines);
  return NextResponse.json({ discountCents });
}
