// Tek seferlik migration scripti: halihazirda referansli (kullanilan) urun
// gorsellerini geriye donuk sikistirir. Bkz. GORSEL_SIKISTIRMA_VE_BLOB_LIMIT_PLANI.md.
// Her url icin: indirir, Faz 1'deki ayni sharp ayarlariyla (max 1600px, WebP, kalite
// ~78) isler, YENI bir Blob path'ine yukler, ilgili DB satirindaki url alanini
// gunceller, basariliysa eski Blob dosyasini siler. Zaten .webp olan gorseller
// (bu script veya Faz 1 tarafindan daha once islenmis kabul edilir) atlanir.
// Bir gorselde hata olursa o gorsel atlanir, script durmaz. Varsayilan dry-run
// (sadece tahmini rapor, hicbir sey indirmez/yuklemez); --execute ile gercek islem,
// opsiyonel --limit N ile kuculuk grup testi.
import "dotenv/config";
import { config } from "dotenv";
config({ path: ".env.local", override: true });
import { put, list, del } from "@vercel/blob";
import { prisma } from "../src/lib/prisma";
import { compressImage } from "../src/lib/image-compress";

const BATCH_SIZE = 20;
const BATCH_DELAY_MS = 300;
const USER_AGENT = "Mozilla/5.0 (compatible; BollmarkImageCompressBot/1.0; +https://www.bollmark.com)";
const ESTIMATED_REDUCTION_RATIO = 0.15; // sikistirma sonrasi tahmini kalan oran (%10-20 araliginin ortasi)

type ImageRef = {
  source: "productImage" | "optionImage" | "category" | "brand" | "review";
  rowId: string;
  url: string;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isAlreadyProcessed(url: string): boolean {
  try {
    return new URL(url).pathname.toLowerCase().endsWith(".webp");
  } catch {
    return url.toLowerCase().endsWith(".webp");
  }
}

async function collectImageRefs(): Promise<ImageRef[]> {
  const refs: ImageRef[] = [];

  const [productImages, optionImages, categories, brands, reviews] = await Promise.all([
    prisma.productImage.findMany({ select: { id: true, url: true } }),
    prisma.productOptionImage.findMany({ select: { id: true, url: true } }),
    prisma.category.findMany({ where: { imageUrl: { not: null } }, select: { id: true, imageUrl: true } }),
    prisma.brand.findMany({ where: { logoUrl: { not: null } }, select: { id: true, logoUrl: true } }),
    prisma.productReview.findMany({ where: { imageUrls: { not: null } }, select: { id: true, imageUrls: true } })
  ]);

  for (const p of productImages) refs.push({ source: "productImage", rowId: p.id, url: p.url });
  for (const o of optionImages) refs.push({ source: "optionImage", rowId: o.id, url: o.url });
  for (const c of categories) if (c.imageUrl) refs.push({ source: "category", rowId: c.id, url: c.imageUrl });
  for (const b of brands) if (b.logoUrl) refs.push({ source: "brand", rowId: b.id, url: b.logoUrl });
  for (const r of reviews) {
    if (!r.imageUrls) continue;
    for (const url of r.imageUrls.split("\n")) {
      const trimmed = url.trim();
      if (trimmed) refs.push({ source: "review", rowId: r.id, url: trimmed });
    }
  }

  return refs;
}

// review satirinda ayni id altinda birden fazla url olabilecegi icin (imageUrls tek bir
// "\n" ayrik string alani), o satirdaki url'i guncellerken satiri taze okuyup yaziyoruz -
// ayni satirin farkli url'leri paralel islenirse birbirini ezmesin diye satir bazinda
// sirali kilit (lock chain) kullaniyoruz.
const rowLocks = new Map<string, Promise<void>>();
function withRowLock(key: string, fn: () => Promise<void>): Promise<void> {
  const prev = rowLocks.get(key) ?? Promise.resolve();
  const next = prev.then(fn, fn);
  rowLocks.set(
    key,
    next.catch(() => undefined)
  );
  return next;
}

async function applyNewUrl(ref: ImageRef, newUrl: string): Promise<void> {
  switch (ref.source) {
    case "productImage":
      await prisma.productImage.update({ where: { id: ref.rowId }, data: { url: newUrl } });
      return;
    case "optionImage":
      await prisma.productOptionImage.update({ where: { id: ref.rowId }, data: { url: newUrl } });
      return;
    case "category":
      await prisma.category.update({ where: { id: ref.rowId }, data: { imageUrl: newUrl } });
      return;
    case "brand":
      await prisma.brand.update({ where: { id: ref.rowId }, data: { logoUrl: newUrl } });
      return;
    case "review":
      await withRowLock(`review:${ref.rowId}`, async () => {
        const row = await prisma.productReview.findUnique({ where: { id: ref.rowId }, select: { imageUrls: true } });
        if (!row?.imageUrls) return;
        const parts = row.imageUrls.split("\n");
        const idx = parts.findIndex((p) => p.trim() === ref.url);
        if (idx === -1) return;
        parts[idx] = newUrl;
        await prisma.productReview.update({ where: { id: ref.rowId }, data: { imageUrls: parts.join("\n") } });
      });
      return;
  }
}

async function processOne(ref: ImageRef): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const res = await fetch(ref.url, { headers: { "User-Agent": USER_AGENT } });
    if (!res.ok) return { ok: false, error: `indirme basarisiz (HTTP ${res.status})` };
    const original = Buffer.from(await res.arrayBuffer());
    const { buffer, contentType, ext } = await compressImage(original);
    const blob = await put(`compressed/${ref.source}-${ref.rowId}-${Date.now()}.${ext}`, buffer, {
      access: "public",
      contentType,
      addRandomSuffix: true
    });
    await applyNewUrl(ref, blob.url);
    await del(ref.url).catch((error) => {
      console.error(`Eski blob silinemedi (yoksayildi): ${ref.url}`, error);
    });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

async function estimateBlobSizes(urls: Set<string>): Promise<Map<string, number>> {
  const sizeByUrl = new Map<string, number>();
  let cursor: string | undefined;
  do {
    const page = await list({ cursor, limit: 1000 });
    for (const b of page.blobs) if (urls.has(b.url)) sizeByUrl.set(b.url, b.size);
    cursor = page.cursor;
  } while (cursor);
  return sizeByUrl;
}

function formatMb(bytes: number): string {
  return (bytes / 1024 / 1024).toFixed(2);
}

async function main() {
  const execute = process.argv.includes("--execute");
  const limitArg = process.argv.find((a) => a.startsWith("--limit="));
  const limit = limitArg ? Number(limitArg.split("=")[1]) : undefined;

  const allRefs = await collectImageRefs();
  const toProcess = allRefs.filter((r) => !isAlreadyProcessed(r.url));
  const alreadyProcessed = allRefs.length - toProcess.length;

  if (!execute) {
    const sizeByUrl = await estimateBlobSizes(new Set(toProcess.map((r) => r.url)));
    const totalBytes = toProcess.reduce((sum, r) => sum + (sizeByUrl.get(r.url) ?? 0), 0);
    const estimatedFinalBytes = totalBytes * ESTIMATED_REDUCTION_RATIO;

    console.log(`Toplam referansli gorsel: ${allRefs.length}`);
    console.log(`Zaten islenmis (.webp) sayilip atlanacak: ${alreadyProcessed}`);
    console.log(`Islenecek gorsel: ${toProcess.length}`);
    console.log(`Mevcut toplam boyut (bulunabilen ${sizeByUrl.size}/${toProcess.length} dosya icin): ${formatMb(totalBytes)} MB`);
    console.log(`Tahmini islem sonrasi boyut (~%${ESTIMATED_REDUCTION_RATIO * 100} oraniyla): ${formatMb(estimatedFinalBytes)} MB`);
    console.log("\nDry-run modu (varsayilan). Gercekten islemek icin --execute (opsiyonel --limit=N) ile calistir.");
    return;
  }

  const targets = typeof limit === "number" && !Number.isNaN(limit) ? toProcess.slice(0, limit) : toProcess;
  console.log(`Islenecek gorsel sayisi: ${targets.length}${alreadyProcessed > 0 ? ` (${alreadyProcessed} zaten .webp, atlandi)` : ""}`);

  let succeeded = 0;
  const failed: { url: string; error: string }[] = [];

  for (let i = 0; i < targets.length; i += BATCH_SIZE) {
    const batch = targets.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(batch.map((ref) => processOne(ref)));
    results.forEach((result, idx) => {
      if (result.ok) succeeded++;
      else failed.push({ url: batch[idx].url, error: result.error });
    });
    console.log(`Islendi: ${Math.min(i + BATCH_SIZE, targets.length)}/${targets.length}`);
    if (i + BATCH_SIZE < targets.length) await sleep(BATCH_DELAY_MS);
  }

  console.log(`\nTamamlandi. Basarili: ${succeeded}, basarisiz: ${failed.length}`);
  if (failed.length > 0) {
    console.log("Basarisiz olan gorseller:");
    for (const f of failed) console.log(`  - ${f.url}: ${f.error}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
