// Mevcut urun gorsellerinin (ProductImage + ProductOptionImage) R2'deki .webp
// dosyalarinin yanina ayni adla .jpg kopyasi yazar - Meta katalogu WebP kabul
// etmiyor (bkz. docs/planlar/META_KATALOG_PLANI.md). Yeni yuklemeler kopyayi
// zaten kendisi yaziyor (lib/image-storage.ts uploadImage).
//
// - Yazma `wrangler r2 object put` ile (wrangler login yeterli, R2 S3 anahtari gerekmez).
// - .webp dosyalarina dokunmaz; DB'ye yazmaz (yalniz okur).
// - Kopyasi zaten olan gorseli atlar: tekrar calistirmak guvenli. Varlik kontrolu
//   herkese acik adrese benzersiz ?kontrol= ile yapilir - Cloudflare'in duz adres
//   icin 404 onbellege almasi engellenir.
// - JPEG kalite 85, boyut WebP ile ayni (yeniden boyutlandirma yok).
//
// Kullanim (.env.local'de R2_PUBLIC_BASE_URL gerekli):
//   npx tsx scripts/r2-jpeg-kopyalari.ts            -> yalniz sayar (yazmaz)
//   npx tsx scripts/r2-jpeg-kopyalari.ts --limit=5  -> eksik ilk 5 kopyayi yazar
//   npx tsx scripts/r2-jpeg-kopyalari.ts --hepsi    -> eksik tum kopyalari yazar
import "dotenv/config";
import { config } from "dotenv";
config({ path: ".env.local", override: true });
import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import sharp from "sharp";
import { prisma } from "../src/lib/prisma";
import { toJpeg } from "../src/lib/image-compress";
import { jpegCopyUrl } from "../src/lib/image-storage";

const BUCKET = "bollmark-images";
const WRANGLER = "wrangler@4.152.0";
const CONCURRENCY = 6;
const run = promisify(execFile);

function parseArgs() {
  const all = process.argv.includes("--hepsi");
  const limitArg = process.argv.find((a) => a.startsWith("--limit="));
  const limit = limitArg ? Number(limitArg.slice("--limit=".length)) : null;
  if (limit !== null && (!Number.isInteger(limit) || limit < 1)) throw new Error("--limit=N pozitif tam sayi olmali");
  return { write: all || limit !== null, limit: all ? Infinity : (limit ?? 0) };
}

async function pool<T>(items: T[], worker: (item: T) => Promise<void>) {
  let next = 0;
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (next < items.length) await worker(items[next++]);
    })
  );
}

async function exists(url: string): Promise<boolean> {
  const res = await fetch(`${url}?kontrol=${Date.now()}-${Math.random().toString(36).slice(2)}`, { method: "HEAD" });
  if (res.status === 404) return false;
  if (!res.ok) throw new Error(`HEAD ${res.status}: ${url}`);
  return true;
}

async function putJpeg(jpegUrl: string, file: string) {
  const key = new URL(jpegUrl).pathname.slice(1);
  // Windows'ta npx bir .cmd oldugu icin shell gerekir; anahtar ve yol bosluksuz ASCII.
  await run(
    "npx",
    ["--yes", WRANGLER, "r2", "object", "put", `${BUCKET}/${key}`, "--file", file, "--content-type", "image/jpeg",
      "--cache-control", '"public, max-age=31536000, immutable"', "--remote"],
    { shell: true, maxBuffer: 1024 * 1024 }
  );
}

async function main() {
  const { write, limit } = parseArgs();
  if (!process.env.R2_PUBLIC_BASE_URL) throw new Error("R2_PUBLIC_BASE_URL tanimli degil (.env.local)");
  const [images, optionImages] = await Promise.all([
    prisma.productImage.findMany({ select: { url: true } }),
    prisma.productOptionImage.findMany({ select: { url: true } })
  ]);
  const urls = [...new Set([...images, ...optionImages].map((i) => i.url))];
  const webps = urls.filter((url) => jpegCopyUrl(url));
  console.log(`Urun gorseli: ${urls.length} tekil, R2 .webp: ${webps.length}, R2 disi / WebP olmayan: ${urls.length - webps.length}`);

  const missing: string[] = [];
  await pool(webps, async (url) => {
    if (!(await exists(jpegCopyUrl(url)!))) missing.push(url);
  });
  console.log(`JPEG kopyasi var: ${webps.length - missing.length}, eksik: ${missing.length}`);
  if (!write) {
    console.log("Yazma yapilmadi. Yazmak icin --limit=N ya da --hepsi.");
    return;
  }

  const targets = missing.sort().slice(0, limit);
  const dir = await mkdtemp(path.join(tmpdir(), "r2-jpeg-"));
  let written = 0;
  let bytes = 0;
  const failed: string[] = [];
  try {
    await pool(targets, async (url) => {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`indirilemedi (${res.status})`);
        const source = sharp(Buffer.from(await res.arrayBuffer()));
        const { width, height } = await source.metadata();
        const jpeg = await toJpeg(source).toBuffer();
        const out = await sharp(jpeg).metadata();
        if (out.width !== width || out.height !== height) throw new Error(`boyut degisti ${width}x${height} -> ${out.width}x${out.height}`);
        const jpegUrl = jpegCopyUrl(url)!;
        const file = path.join(dir, `${written + failed.length}-${path.basename(jpegUrl)}`);
        await writeFile(file, jpeg);
        await putJpeg(jpegUrl, file);
        written++;
        bytes += jpeg.length;
        if (targets.length <= 20) console.log(`  yazildi ${width}x${height} ${(jpeg.length / 1024).toFixed(0)} KB  ${jpegUrl}`);
        else if (written % 50 === 0) console.log(`  ${written}/${targets.length}`);
      } catch (error) {
        failed.push(`${url}: ${error instanceof Error ? error.message.split("\n")[0] : error}`);
      }
    });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
  console.log(`Yazilan: ${written} (${(bytes / 1024 / 1024).toFixed(1)} MB), hata: ${failed.length}`);
  for (const line of failed) console.log(`  HATA ${line}`);
}

main().finally(() => prisma.$disconnect());
