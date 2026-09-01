import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { validateCoupon } from "@/lib/coupons";

const schema = z.object({
  code: z.string().min(1),
  subtotalCents: z.number().int().nonnegative()
});

// Sepet/odeme sayfasinda "Uygula" butonuna anlik geri bildirim vermek icin -
// indirimi UYGULAMAZ, sadece hesaplayip gosterir. Baglayici/nihai hesaplama
// siparis olusturulurken orders/route.ts icinde tekrar yapilir.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ valid: false, message: "Geçersiz istek." }, { status: 400 });
  }

  const result = await validateCoupon(prisma, parsed.data.code, parsed.data.subtotalCents);
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
