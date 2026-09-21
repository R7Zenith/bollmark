import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

// Hiz siniri: ayni IP'den dakikada en fazla 5 yeni kayit. iletisim/route.ts ile
// ayni yontem - sunucusuz ortamda bellek ici sayac guvenilmez, sayac tablonun
// kendisinden (ipHash + createdAt) hesaplanir. Ham IP saklanmaz.
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 5;

const schema = z.object({
  categoryId: z.string().min(1),
  gender: z.string().trim().max(40).optional(),
  email: z.string().trim().max(254).email(),
  // Gorunmez tuzak alan - gercek kullanici asla doldurmaz.
  website: z.string().optional()
});

function hashIp(req: NextRequest): string | null {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip")?.trim();
  if (!ip) return null;
  return createHash("sha256").update(`${process.env.NEXTAUTH_SECRET ?? ""}:${ip}`).digest("hex");
}

// Bos kategori sayfasindaki "haber ver" formundan cagrilir. stok-bildirimi ile
// ayni desen: ayni kisi ayni kategori (+cinsiyet) icin tekrar kayit olursa hata
// degil, mevcut kayit guncellenir - notifiedAt sifirlanir.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Geçerli bir e-posta adresi girin." }, { status: 400 });
  }
  const { categoryId, email, website } = parsed.data;
  const gender = parsed.data.gender ?? "";

  // Botu bilgilendirmemek icin honeypot dolu ise basarili gibi cevap verilir.
  if (website) {
    return NextResponse.json({ ok: true });
  }

  const category = await prisma.category.findUnique({
    where: { id: categoryId, isActive: true },
    select: { id: true }
  });
  if (!category) {
    return NextResponse.json({ error: "Kategori bulunamadı." }, { status: 404 });
  }

  const ipHash = hashIp(req);
  if (ipHash) {
    const recentCount = await prisma.categoryAlert.count({
      where: { ipHash, createdAt: { gte: new Date(Date.now() - RATE_LIMIT_WINDOW_MS) } }
    });
    if (recentCount >= RATE_LIMIT_MAX) {
      return NextResponse.json(
        { error: "Kısa sürede çok fazla istek gönderdiniz. Lütfen biraz sonra tekrar deneyin." },
        { status: 429 }
      );
    }
  }

  await prisma.categoryAlert.upsert({
    where: { categoryId_gender_email: { categoryId, gender, email } },
    create: { categoryId, gender, email, ipHash },
    update: { notifiedAt: null }
  });

  return NextResponse.json({ ok: true });
}
