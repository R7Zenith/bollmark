import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const lineSchema = z.object({
  name: z.string(),
  size: z.string(),
  color: z.string(),
  quantity: z.number().int().positive(),
  priceCents: z.number().int().nonnegative()
});

const schema = z.object({
  email: z.string().email(),
  lines: z.array(lineSchema).min(1),
  totalCents: z.number().int().nonnegative()
});

// Odeme sayfasindaki e-posta alanindan (onBlur) fire-and-forget cagrilir -
// kullanici akisini hicbir sekilde yavaslatmaz/engellemez, hata olursa
// istemci tarafinda sessizce yutulur. Ayni e-posta icin acik (recoveredAt=
// null) bir kayit varsa guncellenir (upsert benzeri), yoksa yeni olusturulur.
// remindedAt sifirlanir ki daha once hatirlatma almis biri sepetini
// guncelleyip yine tamamlamadan ayrilirsa yeniden hatirlatma alsin - ayni
// "tekrar 'haber ver' derse yeniden mail alsin" prensibi StockAlert
// upsert'inde de kullaniliyor (bkz. stok-bildirimi/route.ts).
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
  }
  const { email, lines, totalCents } = parsed.data;
  const linesJson = JSON.stringify(lines);

  const existing = await prisma.abandonedCart.findFirst({
    where: { email, recoveredAt: null },
    orderBy: { createdAt: "desc" }
  });

  if (existing) {
    await prisma.abandonedCart.update({
      where: { id: existing.id },
      data: { linesJson, totalCents, remindedAt: null }
    });
  } else {
    await prisma.abandonedCart.create({ data: { email, linesJson, totalCents } });
  }

  return NextResponse.json({ ok: true });
}
