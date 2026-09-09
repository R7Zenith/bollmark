import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { reuploadImageToBlob } from "@/lib/koton-images";

export const maxDuration = 30;

const MAX_URLS = 10;

// Ürünler sayfasındaki "Görsel linkiyle ekle" butonu için: Koton'da otomatik arama
// (autocomplete/list) hiçbir sonuç vermeyen ürünlerde (bkz. DEPLOY_STATUS.md - arama
// indeksinden tamamen düşmüş ürünler) admin, tarayıcıda "görseli kopyala" ile aldığı
// doğrudan görsel URL'lerini elle yapıştırabiliyor. Görseller Koton'un CDN'ine
// hotlink yapılmadan kendi Vercel Blob depomuza indirilip yeniden yükleniyor, sonra
// ürünün genel `images` listesine (renkten bağımsız) ekleniyor.
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Yetkisiz istek." }, { status: 401 });
  if (session.user?.role !== "ADMIN") return NextResponse.json({ error: "Bu işlem için yetkiniz yok." }, { status: 403 });

  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const rawUrls: unknown = body?.urls;
  if (!Array.isArray(rawUrls) || rawUrls.length === 0) {
    return NextResponse.json({ error: "En az bir görsel URL'i girin." }, { status: 400 });
  }

  const urls = [...new Set(rawUrls.filter((u): u is string => typeof u === "string" && u.trim().length > 0).map((u) => u.trim()))].slice(
    0,
    MAX_URLS
  );
  const invalidUrl = urls.find((u) => !/^https?:\/\//i.test(u));
  if (invalidUrl) {
    return NextResponse.json({ error: `Geçersiz URL: ${invalidUrl}` }, { status: 400 });
  }
  if (urls.length === 0) {
    return NextResponse.json({ error: "En az bir görsel URL'i girin." }, { status: 400 });
  }

  const product = await prisma.product.findUnique({
    where: { id },
    include: { images: { select: { position: true } } }
  });
  if (!product) return NextResponse.json({ error: "Ürün bulunamadı." }, { status: 404 });

  let nextPosition = product.images.reduce((max, img) => Math.max(max, img.position), -1) + 1;

  const uploaded: string[] = [];
  const failed: string[] = [];
  for (const url of urls) {
    const blobUrl = await reuploadImageToBlob(url, `${product.code ?? product.id}-manuel-${uploaded.length}`, "manuel-gorsel");
    if (blobUrl) uploaded.push(blobUrl);
    else failed.push(url);
  }

  if (uploaded.length > 0) {
    await prisma.productImage.createMany({
      data: uploaded.map((url) => ({ productId: product.id, url, alt: product.name, position: nextPosition++ }))
    });
  }

  return NextResponse.json({ added: uploaded.length, failed: failed.length, failedUrls: failed });
}
