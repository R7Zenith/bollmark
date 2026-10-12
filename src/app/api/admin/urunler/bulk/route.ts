import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deleteBlobUrls } from "@/lib/blob";
import { revalidateCatalog } from "@/lib/revalidate-catalog";
import { redirectDeletedProduct } from "@/lib/product-redirects";
import { sanitizeDescriptionHtml } from "@/lib/description-html";
import { logAudit } from "@/lib/audit-log";

const allowedStatuses = new Set(["DRAFT", "PUBLISHED", "ARCHIVED"]);

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Yetkisiz istek." }, { status: 401 });
  }
  if (session.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Bu işlem için yetkiniz yok." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const ids: string[] = Array.isArray(body?.ids)
    ? body.ids.filter((id: unknown): id is string => typeof id === "string")
    : [];
  if (ids.length === 0) {
    return NextResponse.json({ error: "Ürün seçilmedi." }, { status: 400 });
  }

  if (body.action === "DELETE") {
    const targets = await prisma.product.findMany({
      where: { id: { in: ids } },
      select: {
        slug: true,
        gender: true,
        category: { select: { slug: true } },
        images: { select: { url: true } },
        optionImages: { select: { url: true } }
      }
    });
    const urls = targets.flatMap((p) => [...p.images.map((i) => i.url), ...p.optionImages.map((i) => i.url)]);
    try {
      await prisma.$transaction(async (tx) => {
        await tx.product.deleteMany({ where: { id: { in: ids } } });
        for (const target of targets) await redirectDeletedProduct(tx, target);
      }, { timeout: 20000 });
    } catch {
      return NextResponse.json(
        { error: "Seçili ürünlerden biri veya birkaçı mevcut siparişlere bağlı olduğu için silinemedi." },
        { status: 409 }
      );
    }
    await deleteBlobUrls(urls);
    revalidateCatalog();
    return NextResponse.json({ ok: true });
  }

  if (body.action === "SET_STATUS" && allowedStatuses.has(body.status)) {
    await prisma.product.updateMany({ where: { id: { in: ids } }, data: { status: body.status } });
    revalidateCatalog();
    return NextResponse.json({ ok: true });
  }

  if (body.action === "SET_PRICE") {
    if (!Number.isFinite(body.priceCents) || body.priceCents <= 0) {
      return NextResponse.json({ error: "Geçersiz fiyat." }, { status: 400 });
    }
    await prisma.product.updateMany({ where: { id: { in: ids } }, data: { priceCents: body.priceCents } });
    revalidateCatalog();
    return NextResponse.json({ ok: true });
  }

  // Secili urunlerden taslagi olanlarda taslak sitede gorunen aciklama olur
  // (urun sayfasindaki "Kullan" ile ayni, bkz. ai-description-actions.ts).
  if (body.action === "APPROVE_DRAFTS") {
    const drafts = await prisma.product.findMany({
      where: { id: { in: ids }, descriptionDraft: { not: null } },
      select: { id: true, descriptionDraft: true }
    });
    const approvedAt = new Date();
    for (const product of drafts) {
      await prisma.product.update({
        where: { id: product.id },
        data: {
          description: sanitizeDescriptionHtml(product.descriptionDraft),
          descriptionDraft: null,
          descriptionApprovedAt: approvedAt
        }
      });
      logAudit({
        actorEmail: session.user?.email ?? "bilinmiyor",
        actorRole: session.user.role,
        action: "PRODUCT_AI_DESCRIPTION_APPROVED",
        targetType: "Product",
        targetId: product.id,
        detail: "AI açıklaması onaylandı (toplu)"
      });
    }
    if (drafts.length > 0) revalidateCatalog();
    return NextResponse.json({ ok: true, approved: drafts.length });
  }

  // Excel'siz sezon duzeltmesi (bkz. SEZON_BAZLI_SIRALAMA_PLANI.md) - seasonId
  // null ise secili urunlerin sezonu kaldirilir.
  if (body.action === "SET_SEASON") {
    const seasonId: string | null = typeof body.seasonId === "string" && body.seasonId ? body.seasonId : null;
    if (seasonId && !(await prisma.season.findUnique({ where: { id: seasonId }, select: { id: true } }))) {
      return NextResponse.json({ error: "Sezon bulunamadı." }, { status: 400 });
    }
    await prisma.product.updateMany({ where: { id: { in: ids } }, data: { seasonId } });
    revalidateCatalog();
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
}
