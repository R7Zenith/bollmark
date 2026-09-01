import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/mail";
import type { Prisma } from "@/generated/prisma/client";

type Tx = Prisma.TransactionClient;

type VariantSnapshot = { stock: number; pendingEmails: string[] };

type RestockNotification = { email: string; productName: string; productSlug: string };

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
      restockQueue.push({ email, productName: product.name, productSlug: product.slug });
    }
    return;
  }
  await tx.stockAlert.createMany({
    data: old.pendingEmails.map((email) => ({ variantId: newVariant.id, email })),
    skipDuplicates: true
  });
}

/**
 * Kuyruklanmis "tekrar stokta" bildirimlerini gonderir. Transaction
 * tamamlandiktan SONRA, best-effort olarak cagrilmali (deleteBlobUrls ile
 * ayni desen) - mail gonderimi urun kaydetme islemini asla engellememeli.
 */
export async function sendRestockNotifications(items: RestockNotification[]): Promise<void> {
  for (const item of items) {
    await sendMail({
      to: item.email,
      subject: `${item.productName} tekrar stokta`,
      html: `<p>Beklediğiniz <strong>${item.productName}</strong> tekrar stokta.</p><p><a href="https://bollmark.com/urunler/${item.productSlug}">Ürünü görüntüle</a></p>`
    });
  }
}
