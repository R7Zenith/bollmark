// Tek seferlik script: Vercel Blob'daki eski gorselleri R2'ye tasir. Bkz.
// BLOB_TAMAMEN_KALDIRMA_PLANI.md. Blob list() KULLANILMAZ; liste veritabanindan cikar.
//   --envanter           : salt okuma. Blob'a hic istek atmaz, hicbir sey yazmaz.
//   --kopyala            : secilen gorselleri byte byte R2'ye kopyalar (DB'ye dokunmaz).
//   --db-guncelle        : secilen satirlardan tasinmis olanlarin url'ini gunceller (yedek + sayim).
//   --geri-al <yedek>    : yedek dosyasindaki eski adresleri geri yazar.
// Blob'dan hicbir sey SILINMEZ.
import "dotenv/config";
import { config } from "dotenv";
config({ path: ".env.local", override: true });
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { AwsClient } from "aws4fetch";
import { prisma } from "../src/lib/prisma";

const BLOB_HOST = ".public.blob.vercel-storage.com";
const OUTPUT_DIR = join("scripts", "output");
const MAPPING_FILE = join(OUTPUT_DIR, "blob-r2-eslesme.json");

const BLOB_URL_RE = /https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\/[^\s"'<>)\\]+/g;

type Column = { table_name: string; column_name: string; data_type: string };

// Gozden kacan alan kalmasin diye public semasindaki tum metin/JSON/dizi kolonlari taranir.
async function findBlobColumns() {
  const columns = await prisma.$queryRawUnsafe<Column[]>(
    `SELECT table_name::text, column_name::text, data_type::text FROM information_schema.columns
     WHERE table_schema = 'public' AND data_type IN ('text', 'character varying', 'json', 'jsonb', 'ARRAY')
     ORDER BY table_name, column_name`
  );
  const found: { table: string; column: string; type: string; values: string[] }[] = [];
  for (const c of columns) {
    const rows = await prisma.$queryRawUnsafe<{ v: string }[]>(
      `SELECT "${c.column_name}"::text AS v FROM "${c.table_name}"
       WHERE "${c.column_name}"::text LIKE '%blob.vercel-storage.com%'`
    );
    if (rows.length > 0) {
      found.push({ table: c.table_name, column: c.column_name, type: c.data_type, values: rows.map((r) => r.v) });
    }
  }
  return { scanned: columns.length, found };
}

async function envanter() {
  const { scanned, found } = await findBlobColumns();
  const unique = new Set<string>();

  console.log(`Taranan kolon sayisi: ${scanned}`);
  console.log("\nBlob adresi iceren tablo/kolonlar:");
  for (const f of found) {
    const urls = f.values.flatMap((v) => v.match(BLOB_URL_RE) ?? []);
    const whole = f.values.filter((v) => urls.includes(v)).length;
    for (const u of urls) unique.add(u);
    console.log(
      `  ${f.table}.${f.column} (${f.type}): ${f.values.length} satir, ${urls.length} adres, ` +
        `${new Set(urls).size} benzersiz, degerin tamami adres olan satir: ${whole}`
    );
  }
  if (found.length === 0) console.log("  (yok)");

  const hosts = new Map<string, number>();
  const folders = new Map<string, number>();
  const exts = new Map<string, number>();
  let encoded = 0;
  let withQuery = 0;
  for (const u of unique) {
    const url = new URL(u);
    hosts.set(url.hostname, (hosts.get(url.hostname) ?? 0) + 1);
    const folder = url.pathname.split("/").slice(1, -1).join("/") || "(kok)";
    folders.set(folder, (folders.get(folder) ?? 0) + 1);
    const ext = url.pathname.match(/\.([a-z0-9]+)$/i)?.[1].toLowerCase() ?? "(yok)";
    exts.set(ext, (exts.get(ext) ?? 0) + 1);
    if (/%|[^\x20-\x7e]/.test(u)) encoded++;
    if (url.search) withQuery++;
  }

  console.log(`\nBENZERSIZ Blob URL sayisi: ${unique.size}  (= indirmenin harcayacagi en fazla Simple Operation)`);
  console.log("Host:", Object.fromEntries(hosts));
  console.log("Klasor:", Object.fromEntries(folders));
  console.log("Uzanti:", Object.fromEntries(exts));
  console.log(`'%' ya da ASCII disi karakter iceren adres: ${encoded}, sorgu (?...) iceren: ${withQuery}`);

  const products = await prisma.product.count({
    where: {
      OR: [
        { images: { some: { url: { contains: "blob.vercel-storage.com" } } } },
        { optionImages: { some: { url: { contains: "blob.vercel-storage.com" } } } }
      ]
    }
  });
  console.log(`Blob gorseli olan urun sayisi: ${products}`);

  const byStatus = await prisma.$queryRawUnsafe<{ status: string; urun: number; gorsel: number; kapak: number }[]>(
    `SELECT p.status, COUNT(DISTINCT p.id)::int AS urun, COUNT(*)::int AS gorsel,
            (COUNT(*) FILTER (WHERE i."isCover" OR i.position = 0))::int AS kapak
     FROM "ProductOptionImage" i JOIN "Product" p ON p.id = i."productId"
     WHERE i.url LIKE '%blob.vercel-storage.com%' GROUP BY p.status`
  );
  console.log("Urun durumuna gore (kapak = isCover ya da position 0):");
  console.table(byStatus);
}

// --- Secim: tasinacak satirlar her zaman veritabanindan, adresi hala Blob'da olanlardan cikar.
// Bu yuzden script kaldigi yerden devam eder: guncellenen satir bir daha secilmez.

type Row = {
  id: string;
  url: string;
  productId: string;
  position: number;
  isCover: boolean;
  product: { status: string; code: string | null; slug: string; name: string };
};

async function selectRows(): Promise<Row[]> {
  const urun = argValue("--urun");
  const limit = Number(argValue("--limit") ?? Infinity);
  const all: Row[] = await prisma.productOptionImage.findMany({
    where: { url: { contains: BLOB_HOST } },
    select: {
      id: true,
      url: true,
      productId: true,
      position: true,
      isCover: true,
      product: { select: { status: true, code: true, slug: true, name: true } }
    },
    orderBy: [{ productId: "asc" }, { valueId: "asc" }, { position: "asc" }]
  });
  // Yayindaki urunler once, arsivliler en sona (siralama kararli: urun gruplari bozulmaz).
  all.sort((a, b) => Number(a.product.status !== "PUBLISHED") - Number(b.product.status !== "PUBLISHED"));

  if (urun) return all.filter((r) => r.product.code === urun || r.product.slug === urun);
  if (process.argv.includes("--kapak")) {
    return all.filter((r) => r.product.status === "PUBLISHED" && (r.isCover || r.position === 0)).slice(0, limit);
  }
  // --limit urun sinirinda keser: bir urunun kalan gorselleri ayni partide tasinir.
  const picked: Row[] = [];
  for (let i = 0; i < all.length; ) {
    let j = i;
    while (j < all.length && all[j].productId === all[i].productId) j++;
    if (picked.length > 0 && picked.length + (j - i) > limit) break;
    picked.push(...all.slice(i, j));
    i = j;
  }
  return picked;
}

function argValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function productSummary(rows: Row[]): string[] {
  const counts = new Map<string, number>();
  for (const r of rows) {
    const label = `${r.product.code ?? r.product.slug} (${r.product.status})`;
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return [...counts].map(([label, n]) => `${label}: ${n}`);
}

// --- Eslesme dosyasi

type Mapping = Record<
  string,
  { yeni: string; boyut?: number; sha256?: string; contentType?: string; durum: "ok" | "atlandı" | "hata"; hata?: string }
>;

function loadMapping(): Mapping {
  return existsSync(MAPPING_FILE) ? JSON.parse(readFileSync(MAPPING_FILE, "utf8")) : {};
}

function saveMapping(mapping: Mapping) {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  writeFileSync(MAPPING_FILE, JSON.stringify(mapping, null, 1));
}

// --- Faz 1: kopyalama (byte byte; sharp/compressImage YOK)

// src/lib/image-storage.ts'teki r2Config ile ayni.
function r2Config() {
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_PUBLIC_BASE_URL } = process.env;
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET || !R2_PUBLIC_BASE_URL) {
    throw new Error("R2 ortam degiskenleri eksik.");
  }
  return {
    client: new AwsClient({
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
      service: "s3",
      region: "auto"
    }),
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET}`,
    publicBaseUrl: R2_PUBLIC_BASE_URL.replace(/\/+$/, "")
  };
}

const sha256 = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

async function kopyala(rows: Row[]) {
  const r2 = r2Config();
  const mapping = loadMapping();
  const urls = [...new Set(rows.map((r) => r.url))];
  let indirme = 0;
  let atlanan = 0;
  let hata = 0;
  let aborted: Error | null = null;

  async function copyOne(eski: string) {
    // Anahtar URL'deki (kodlanmis) pathname ile kurulur: "%20" her iki adreste de ayni kalir.
    const path = `/blob${new URL(eski).pathname}`;
    const yeni = `${r2.publicBaseUrl}${path}`;

    const headSigned = await r2.client.sign(`${r2.endpoint}${path}`, { method: "HEAD" });
    const head = await fetch(headSigned.url, { method: "HEAD", headers: headSigned.headers });
    if (head.status === 200) {
      atlanan++;
      if (!mapping[eski] || mapping[eski].durum === "hata") {
        mapping[eski] = { yeni, boyut: Number(head.headers.get("content-length")), durum: "atlandı" };
      }
      return;
    }
    // R2 erisimi bozuksa (yetki vb.) Blob indirme hakki bosa harcanmasin: tum is durur.
    if (head.status !== 404) throw new Error(`R2 HEAD beklenmeyen durum ${head.status}`);

    indirme++;
    const res = await fetch(eski);
    if (!res.ok) {
      hata++;
      mapping[eski] = { yeni, durum: "hata", hata: `Blob GET ${res.status}` };
      return;
    }
    const body = new Uint8Array(await res.arrayBuffer());
    const contentType = res.headers.get("content-type") ?? "image/webp";
    const hash = sha256(body);

    // Indirilen dosya bosa gitmesin diye R2 yazimi birkac kez denenir.
    let problem = "";
    for (let attempt = 0; attempt < 3; attempt++) {
      const signed = await r2.client.sign(`${r2.endpoint}${path}`, {
        method: "PUT",
        body,
        headers: { "Content-Type": contentType, "Cache-Control": "public, max-age=31536000, immutable" }
      });
      const put = await fetch(signed.url, { method: "PUT", headers: signed.headers, body });
      if (!put.ok) {
        problem = `R2 PUT ${put.status}`;
        continue;
      }
      // Dogrulama herkese acik yeni adresten: site de dosyayi buradan okuyacak.
      const check = await fetch(yeni);
      const got = check.ok ? new Uint8Array(await check.arrayBuffer()) : null;
      if (got && got.length === body.length && sha256(got) === hash) {
        mapping[eski] = { yeni, boyut: body.length, sha256: hash, contentType, durum: "ok" };
        return;
      }
      problem = got ? "yeni adresteki icerik orijinalle ayni degil" : `yeni adres GET ${check.status}`;
    }
    hata++;
    mapping[eski] = { yeni, durum: "hata", hata: problem };
  }

  let next = 0;
  await Promise.all(
    Array.from({ length: 4 }, async () => {
      while (next < urls.length && !aborted) {
        const eski = urls[next++];
        try {
          await copyOne(eski);
        } catch (err) {
          aborted = err as Error;
        }
        saveMapping(mapping);
      }
    })
  );

  console.log(`Kopyalama: ${urls.length} adres | Blob indirmesi: ${indirme} | R2'de oldugu icin atlanan: ${atlanan} | hata: ${hata}`);
  for (const u of urls) if (mapping[u]?.durum === "hata") console.log(`  HATA ${u} -> ${mapping[u].hata}`);
  if (aborted) throw aborted;
}

// --- Faz 2: veritabani adresleri

// url disindaki her sey: gruplarin sayimi + tum satirlarin (url haric) ozeti.
async function sayim() {
  const [optionRows, productImages, kategori, marka] = await Promise.all([
    prisma.productOptionImage.findMany({
      select: { id: true, productId: true, valueId: true, position: true, isCover: true, alt: true },
      orderBy: { id: "asc" }
    }),
    prisma.productImage.groupBy({ by: ["productId"], _count: true, orderBy: { productId: "asc" } }),
    prisma.category.count({ where: { imageUrl: { not: null } } }),
    prisma.brand.count({ where: { logoUrl: { not: null } } })
  ]);
  const gruplar: Record<string, { satir: number; kapak: number }> = {};
  for (const r of optionRows) {
    const g = (gruplar[`${r.productId}|${r.valueId}`] ??= { satir: 0, kapak: 0 });
    g.satir++;
    if (r.isCover) g.kapak++;
  }
  return {
    optionImageSatir: optionRows.length,
    optionImageAlanOzeti: createHash("sha256").update(JSON.stringify(optionRows)).digest("hex"),
    optionImageGruplar: gruplar,
    productImage: Object.fromEntries(productImages.map((p) => [p.productId, p._count])),
    kategoriGorsel: kategori,
    markaLogo: marka
  };
}

type Change = { tablo: "ProductOptionImage"; id: string; kolon: "url"; eskiDeger: string; yeniDeger: string };

// Satirlar id ile, yalniz url alani ve yalniz beklenen eski degerdeyse guncellenir.
async function applyChanges(changes: { id: string; from: string; to: string }[], stamp: string) {
  const once = await sayim();
  writeFileSync(join(OUTPUT_DIR, `blob-r2-sayim-${stamp}-once.json`), JSON.stringify(once, null, 1));

  let updated = 0;
  for (let i = 0; i < changes.length; i += 50) {
    const results = await prisma.$transaction(
      changes.slice(i, i + 50).map((c) =>
        prisma.productOptionImage.updateMany({ where: { id: c.id, url: c.from }, data: { url: c.to } })
      )
    );
    updated += results.reduce((sum, r) => sum + r.count, 0);
  }

  const sonra = await sayim();
  writeFileSync(join(OUTPUT_DIR, `blob-r2-sayim-${stamp}-sonra.json`), JSON.stringify(sonra, null, 1));
  console.log(`Guncellenen satir: ${updated} / ${changes.length}`);
  if (JSON.stringify(once) !== JSON.stringify(sonra)) {
    throw new Error(`SAYIM FARKLI! blob-r2-sayim-${stamp}-once.json ile -sonra.json dosyalarini karsilastir.`);
  }
  console.log(`Sayim karsilastirmasi: AYNI (${sonra.optionImageSatir} satir, url disi alan ozeti ayni)`);
  if (updated !== changes.length) throw new Error("Bazi satirlar guncellenmedi (deger bu arada degismis olabilir).");
}

async function dbGuncelle(rows: Row[]) {
  const mapping = loadMapping();
  const ready = rows.filter((r) => mapping[r.url] && mapping[r.url].durum !== "hata");
  console.log(`DB guncelleme: secilen ${rows.length} satir, tasinmis olan ${ready.length}`);
  if (ready.length === 0) return;

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  mkdirSync(OUTPUT_DIR, { recursive: true });
  const backup: Change[] = ready.map((r) => ({
    tablo: "ProductOptionImage",
    id: r.id,
    kolon: "url",
    eskiDeger: r.url,
    yeniDeger: mapping[r.url].yeni
  }));
  const backupFile = join(OUTPUT_DIR, `blob-r2-yedek-${stamp}.json`);
  writeFileSync(backupFile, JSON.stringify(backup, null, 1));
  console.log(`Yedek: ${backupFile}`);

  await applyChanges(backup.map((b) => ({ id: b.id, from: b.eskiDeger, to: b.yeniDeger })), stamp);
  console.log("Tasinan urunler (gorsel sayisi):");
  for (const line of productSummary(ready)) console.log(`  ${line}`);
}

async function geriAl(file: string) {
  const backup: Change[] = JSON.parse(readFileSync(file, "utf8"));
  const stamp = `${new Date().toISOString().replace(/[:.]/g, "-")}-geri-al`;
  console.log(`Geri alma: ${backup.length} satir (${file})`);
  await applyChanges(backup.map((b) => ({ id: b.id, from: b.yeniDeger, to: b.eskiDeger })), stamp);
}

async function main() {
  const has = (flag: string) => process.argv.includes(flag);
  if (has("--envanter")) return envanter();
  if (has("--geri-al")) return geriAl(argValue("--geri-al")!);

  // Secim: --urun <kod|slug> | --kapak | (hepsi), istege bagli --limit N. Eylem yoksa yalniz secimi gosterir.
  const rows = await selectRows();
  console.log(`Secim: ${rows.length} satir, ${new Set(rows.map((r) => r.url)).size} benzersiz adres, ${new Set(rows.map((r) => r.productId)).size} urun`);
  if (has("--kopyala")) await kopyala(rows);
  if (has("--db-guncelle")) await dbGuncelle(rows);
  if (!has("--kopyala") && !has("--db-guncelle")) for (const line of productSummary(rows)) console.log(`  ${line}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
