import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  variantId: z.string(),
  email: z.string().email()
});

// Urun detay sayfasinda stokta olmayan bir varyant icin "stok gelince haber
// ver" formundan cagrilir. Ayni kisi ayni varyant icin tekrar kayit olursa
// hata degil, mevcut kayit guncellenir (upsert) - notifiedAt sifirlanir ki
// daha once bildirim almis biri tekrar "haber ver" derse yeniden mail alsin.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
  }

  const variant = await prisma.productVariant.findUnique({ where: { id: parsed.data.variantId } });
  if (!variant) {
    return NextResponse.json({ error: "Varyant bulunamadı." }, { status: 404 });
  }

  await prisma.stockAlert.upsert({
    where: { variantId_email: { variantId: parsed.data.variantId, email: parsed.data.email } },
    create: { variantId: parsed.data.variantId, email: parsed.data.email },
    update: { notifiedAt: null }
  });

  return NextResponse.json({ ok: true });
}
