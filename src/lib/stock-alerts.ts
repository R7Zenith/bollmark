import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/mail";
import type { Prisma } from "@/generated/prisma/client";
import { badge, button, emailSiteUrl, escapeHtml, heading, paragraph, renderEmail, type RenderedEmail } from "@/lib/email/layout";
import { emailProductImagesSelect, emailVariantSelect, variantImageUrl, variantValues } from "@/lib/email/product-image";

type Tx = Prisma.TransactionClient;

type VariantSnapshot = { stock: number; pendingEmails: string[] };

// variantId: e-postadaki gorsel ve renk/beden icin (gonderimde okunur).
type RestockNotification = { email: string; productName: string; productSlug: string; variantId?: string };

// Urun kaydetme akisinda (urunler/[id]/page.tsx) ProductVariant kayitlari her
// guncellemede silinip yeniden olusturuluyor (yeni id ile), bu yuzden
// StockAlert kayitlari (onDelete: Cascade) yeni varyant olusturulmadan once
// kaybolur. Kaydetmeden HEMEN once bu fonksiyonla eski varyantlarin (SKU'ya
// gore) stok + bekleyen (notifiedAt: null) StockAlert e-postalarinin bir
// anlik goruntusu alinir; yeni varyantlar olusturulduktan sonra
// carryOverOrQueueRestock ile SKU eslesmesine gore ya yeni varyanta tasinir
// ya da (0 -> pozitif gecis oldugunda) bildirim kuyruguna eklenir.
export async function snapshotStockAlerts(productId: string): Promise<Map<string, VariantSnapshot>> {
  const variants = await prisma.productVariant.findMany({
    where: { productId },
    select: {
      sku: true,
      stock: true,
      stockAlerts: { where: { notifiedAt: null }, select: { email: true } }
    }
  });
  return new Map(
    variants.map((v) => [v.sku, { stock: v.stock, pendingEmails: v.stockAlerts.map((a) => a.email) }])
  );
}

export async function carryOverOrQueueRestock(
  tx: Tx,
  snapshot: Map<string, VariantSnapshot>,
  newVariant: { id: string; sku: string; stock: number },
  product: { name: string; slug: string },
  restockQueue: RestockNotification[]
): Promise<void> {
  const old = snapshot.get(newVariant.sku);
  if (!old || old.pendingEmails.length === 0) return;

  if (old.stock === 0 && newVariant.stock > 0) {
    for (const email of old.pendingEmails) {
      restockQueue.push({ email, productName: product.name, productSlug: product.slug, variantId: newVariant.id });
    }
    return;
  }
  await tx.stockAlert.createMany({
    data: old.pendingEmails.map((email) => ({ variantId: newVariant.id, email })),
    skipDuplicates: true
  });
}

export type RestockEmailInput = { productName: string; productUrl: string; variant: string; imageUrl: string | null };

// MAIL_TASARIMLARI_PLANI.md 08. Abonelikten cikma mekanizmasi olmadigi icin link eklenmez.
export function restockEmail(input: RestockEmailInput, siteUrl = emailSiteUrl()): RenderedEmail {
  const image = input.imageUrl
    ? `<img src="${escapeHtml(input.imageUrl)}" alt="${escapeHtml(input.productName)}" width="340" style="display:block;width:100%;max-width:340px;height:auto;margin:0 auto 18px;border-radius:12px">`
    : "";
  return renderEmail({
    siteUrl,
    subject: `${input.productName} tekrar stokta`,
    preheader: "Haber vermemizi istediğin ürün geri geldi.",
    footer: "transactional",
    blocks: [
      badge("TEKRAR STOKTA", "red", "🔔"),
      heading("Beklediğin ürün geri geldi!"),
      paragraph("Haber vermemizi istediğin ürün tekrar stokta. Sınırlı sayıda, kaçırmadan al."),
      image,
      paragraph(`<strong>${escapeHtml(input.productName)}</strong>`, { align: "center", size: 17, color: "#111111", margin: "0 0 4px" }),
      input.variant ? paragraph(escapeHtml(input.variant), { align: "center", size: 14 }) : "",
      button("Hemen incele", input.productUrl)
    ],
    textLines: [
      `Beklediğin ürün tekrar stokta: ${input.productName}${input.variant ? ` (${input.variant})` : ""}`,
      `Hemen incele: ${input.productUrl}`
    ]
  });
}

// Varyantin renk/beden bilgisi ve gorseli. Yalniz okur; varyant yoksa urunun ilk gorseli.
export async function loadRestockInfo(item: RestockNotification): Promise<RestockEmailInput> {
  const siteUrl = emailSiteUrl();
  const [variant, product] = await Promise.all([
    item.variantId ? prisma.productVariant.findUnique({ where: { id: item.variantId }, select: emailVariantSelect }) : null,
    prisma.product.findUnique({ where: { slug: item.productSlug }, select: emailProductImagesSelect })
  ]);
  return {
    productName: item.productName,
    productUrl: `${siteUrl}/urunler/${encodeURIComponent(item.productSlug)}`,
    variant: variantValues(variant),
    imageUrl: product ? variantImageUrl(product, variant) : null
  };
}

/**
 * Kuyruklanmis "tekrar stokta" bildirimlerini gonderir. Transaction
 * tamamlandiktan SONRA, best-effort olarak cagrilmali (deleteBlobUrls ile
 * ayni desen) - mail gonderimi urun kaydetme islemini asla engellememeli.
 */
export async function sendRestockNotifications(items: RestockNotification[]): Promise<void> {
  for (const item of items) {
    try {
      await sendMail({ to: item.email, ...restockEmail(await loadRestockInfo(item)) });
    } catch (error) {
      console.error("Stok bildirimi e-postasi hazirlanamadi (yoksayildi):", error);
    }
  }
}
