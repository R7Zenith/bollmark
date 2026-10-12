"use server";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-admin";
import { logAudit } from "@/lib/audit-log";
import { revalidateCatalog } from "@/lib/revalidate-catalog";
import { sanitizeDescriptionHtml } from "@/lib/description-html";

// Ürün düzenleme sayfasındaki özgün açıklama paneli (bkz.
// SEO_FAZ6_OZGUN_ACIKLAMA_VE_YONLENDIRME_PLANI.md bölüm A4). Server action'lar
// doğrudan POST ile de çağrılabildiği için yetki her birinin içinde kontrol edilir.
type Result = { ok: true } | { ok: false; error: string };

// "Kullan": yöneticinin (gerekirse düzenlediği) taslağı sitede görünen açıklama olur.
export async function approveDraft(productId: string, draftHtml: string): Promise<Result> {
  const session = await requireAdmin();
  const description = sanitizeDescriptionHtml(draftHtml);
  if (!description) return { ok: false, error: "Taslak boş, kullanılamaz." };

  const product = await prisma.product.findUnique({ where: { id: productId }, select: { descriptionDraft: true } });
  if (!product?.descriptionDraft) return { ok: false, error: "Onay bekleyen taslak bulunamadı." };

  const updated = await prisma.product.update({
    where: { id: productId },
    data: { description, descriptionDraft: null, descriptionApprovedAt: new Date() },
    select: { slug: true }
  });
  logAudit({
    actorEmail: session.user?.email ?? "bilinmiyor",
    actorRole: session.user?.role ?? "ADMIN",
    action: "PRODUCT_AI_DESCRIPTION_APPROVED",
    targetType: "Product",
    targetId: productId,
    detail: "AI açıklaması onaylandı"
  });
  revalidateCatalog(updated.slug);
  return { ok: true };
}

export async function discardDraft(productId: string): Promise<Result> {
  await requireAdmin();
  await prisma.product.update({ where: { id: productId }, data: { descriptionDraft: null } });
  return { ok: true };
}

// "Orijinal metne dön": tedarikçinin ilk metni yeniden sitede görünen açıklama olur.
export async function restoreOriginalDescription(productId: string): Promise<Result> {
  await requireAdmin();
  const product = await prisma.product.findUnique({ where: { id: productId }, select: { originalDescription: true } });
  if (!product?.originalDescription) return { ok: false, error: "Orijinal metin kayıtlı değil." };

  const updated = await prisma.product.update({
    where: { id: productId },
    data: { description: product.originalDescription, descriptionApprovedAt: null },
    select: { slug: true }
  });
  revalidateCatalog(updated.slug);
  return { ok: true };
}
