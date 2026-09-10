// Tek seferlik script: Vercel Blob store'undaki, veritabaninin hicbir yerinde
// referans edilmeyen ("yetim") dosyalari bulup siler. Bkz.
// GORSEL_SIKISTIRMA_VE_BLOB_LIMIT_PLANI.md. Bir blob'un "kullaniliyor" sayilmasi
// icin referans edilebilecegi 5 kaynak: ProductImage.url, ProductOptionImage.url,
// Category.imageUrl, Brand.logoUrl, ProductReview.imageUrls ("\n" ayrik liste).
// Varsayilan dry-run (sadece rapor); --execute ile gercekten siler.
import "dotenv/config";
import { config } from "dotenv";
config({ path: ".env.local", override: true });
import { list, del } from "@vercel/blob";
import { prisma } from "../src/lib/prisma";

async function collectReferencedUrls(): Promise<Set<string>> {
  const referenced = new Set<string>();

  const [productImages, optionImages, categories, brands, reviews] = await Promise.all([
    prisma.productImage.findMany({ select: { url: true } }),
    prisma.productOptionImage.findMany({ select: { url: true } }),
    prisma.category.findMany({ where: { imageUrl: { not: null } }, select: { imageUrl: true } }),
    prisma.brand.findMany({ where: { logoUrl: { not: null } }, select: { logoUrl: true } }),
    prisma.productReview.findMany({ where: { imageUrls: { not: null } }, select: { imageUrls: true } })
  ]);

  for (const p of productImages) referenced.add(p.url);
  for (const o of optionImages) referenced.add(o.url);
  for (const c of categories) if (c.imageUrl) referenced.add(c.imageUrl);
  for (const b of brands) if (b.logoUrl) referenced.add(b.logoUrl);
  for (const r of reviews) {
    if (!r.imageUrls) continue;
    for (const url of r.imageUrls.split("\n")) {
      const trimmed = url.trim();
      if (trimmed) referenced.add(trimmed);
    }
  }

  return referenced;
}

async function listAllBlobs(): Promise<{ url: string; pathname: string; size: number }[]> {
  const blobs: { url: string; pathname: string; size: number }[] = [];
  let cursor: string | undefined;
  do {
    const page = await list({ cursor, limit: 1000 });
    for (const b of page.blobs) blobs.push({ url: b.url, pathname: b.pathname, size: b.size });
    cursor = page.cursor;
  } while (cursor);
  return blobs;
}

function formatMb(bytes: number): string {
  return (bytes / 1024 / 1024).toFixed(2);
}

async function main() {
  const execute = process.argv.includes("--execute");

  const [referenced, blobs] = await Promise.all([collectReferencedUrls(), listAllBlobs()]);
  const orphans = blobs.filter((b) => !referenced.has(b.url));
  const orphanBytes = orphans.reduce((sum, b) => sum + b.size, 0);

  console.log(`Toplam blob: ${blobs.length}, referansli: ${referenced.size}, yetim: ${orphans.length}`);
  console.log(`Yetim dosyalarin toplam boyutu: ${formatMb(orphanBytes)} MB`);
  console.log("Ornek yetim url'ler:");
  for (const b of orphans.slice(0, 10)) console.log(`  - ${b.pathname} (${formatMb(b.size)} MB)`);

  if (!execute) {
    console.log("\nDry-run modu (varsayilan). Gercekten silmek icin --execute ile calistir.");
    return;
  }

  if (orphans.length === 0) {
    console.log("\nSilinecek yetim dosya yok.");
    return;
  }

  let deleted = 0;
  let deletedBytes = 0;
  const batchSize = 100;
  for (let i = 0; i < orphans.length; i += batchSize) {
    const batch = orphans.slice(i, i + batchSize);
    await del(batch.map((b) => b.url));
    deleted += batch.length;
    deletedBytes += batch.reduce((sum, b) => sum + b.size, 0);
  }

  console.log(`\nTamamlandi. ${deleted} dosya silindi, ${formatMb(deletedBytes)} MB bosaldi.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
