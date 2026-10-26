// Meta katalog feed'ini (/feed/meta.xml) denetler - YALNIZ OKUR: feed'i ve
// gorselleri indirir, veritabanina ve R2'ye hicbir sey yazmaz
// (bkz. docs/planlar/META_KATALOG_PLANI.md).
//
// Sayar ve listeler: zorunlu alan eksikleri, gecersiz availability / price
// bicimleri, tekrarlanan id'ler, JPEG/PNG olmayan gorseller (gercek
// Content-Type ile) ve 500px altindaki gorseller.
//
// Kullanim:
//   npx tsx scripts/meta-feed-kontrol.ts                      -> http://localhost:3000/feed/meta.xml
//   npx tsx scripts/meta-feed-kontrol.ts https://bollmark.com/feed/meta.xml
import sharp from "sharp";

const FEED_URL = process.argv[2] ?? "http://localhost:3000/feed/meta.xml";
const REQUIRED = ["g:id", "title", "description", "g:availability", "g:condition", "g:price", "link", "g:image_link", "g:brand"];
const AVAILABILITY = new Set(["in stock", "out of stock"]);
const PRICE = /^\d+\.\d{2} [A-Z]{3}$/;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png"]);
const MIN_SIDE = 500;
const CONCURRENCY = 12;
const SHOW = 10;

function unescapeXml(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function values(item: string, tag: string): string[] {
  return [...item.matchAll(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "g"))].map((m) => unescapeXml(m[1]));
}

function report(label: string, list: string[]) {
  console.log(`${label}: ${list.length}`);
  for (const line of list.slice(0, SHOW)) console.log(`  - ${line}`);
  if (list.length > SHOW) console.log(`  … ve ${list.length - SHOW} tane daha`);
}

async function main() {
  console.log(`Feed: ${FEED_URL}`);
  const res = await fetch(FEED_URL);
  if (!res.ok) throw new Error(`Feed alinamadi (${res.status})`);
  const xml = await res.text();
  // <item> icindeki g:shipping'in kendi g:price'i var; once o blok cikarilir.
  const items = xml.split("<item>").slice(1).map((s) => s.split("</item>")[0].replace(/<g:shipping>[\s\S]*?<\/g:shipping>/, ""));
  console.log(`Item: ${items.length}\n`);

  const missing: string[] = [];
  const badAvailability: string[] = [];
  const badPrice: string[] = [];
  const idCount = new Map<string, number>();
  const images = new Set<string>();
  const availabilityCount = new Map<string, number>();

  for (const item of items) {
    const id = values(item, "g:id")[0] ?? "(id yok)";
    idCount.set(id, (idCount.get(id) ?? 0) + 1);
    const empty = REQUIRED.filter((tag) => !values(item, tag)[0]?.trim());
    if (empty.length > 0) missing.push(`${id}: ${empty.join(", ")}`);

    const availability = values(item, "g:availability")[0] ?? "";
    availabilityCount.set(availability, (availabilityCount.get(availability) ?? 0) + 1);
    if (!AVAILABILITY.has(availability)) badAvailability.push(`${id}: "${availability}"`);

    for (const tag of ["g:price", "g:sale_price"]) {
      for (const price of values(item, tag)) if (!PRICE.test(price)) badPrice.push(`${id} ${tag}: "${price}"`);
    }
    for (const url of [...values(item, "g:image_link"), ...values(item, "g:additional_image_link")]) images.add(url);
  }

  const duplicates = [...idCount].filter(([, n]) => n > 1).map(([id, n]) => `${id} (${n} kez)`);
  report("Zorunlu alani eksik item", missing);
  console.log(`availability dagilimi: ${[...availabilityCount].map(([v, n]) => `"${v}"=${n}`).join(", ")}`);
  report("Gecersiz availability", badAvailability);
  report("Gecersiz fiyat bicimi", badPrice);
  report("Tekrarlanan id", duplicates);

  console.log(`\nTekil gorsel: ${images.size} (hepsi indirilip olculuyor)`);
  const typeCount = new Map<string, number>();
  const badType: string[] = [];
  const small: string[] = [];
  const failed: string[] = [];
  const queue = [...images];
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      for (let url = queue.shift(); url; url = queue.shift()) {
        try {
          const img = await fetch(url);
          if (!img.ok) throw new Error(`HTTP ${img.status}`);
          const type = (img.headers.get("content-type") ?? "(yok)").split(";")[0].trim();
          typeCount.set(type, (typeCount.get(type) ?? 0) + 1);
          if (!IMAGE_TYPES.has(type)) badType.push(`${type} ${url}`);
          const { width = 0, height = 0 } = await sharp(Buffer.from(await img.arrayBuffer())).metadata();
          if (width < MIN_SIDE || height < MIN_SIDE) small.push(`${width}x${height} ${url}`);
        } catch (error) {
          failed.push(`${url}: ${error instanceof Error ? error.message : error}`);
        }
      }
    })
  );
  console.log(`Content-Type dagilimi: ${[...typeCount].map(([t, n]) => `${t}=${n}`).join(", ")}`);
  report("JPEG/PNG olmayan gorsel (WebP/AVIF vb.)", badType);
  report(`${MIN_SIDE}px alti gorsel`, small);
  report("Indirilemeyen gorsel", failed);

  const problems = missing.length + badAvailability.length + badPrice.length + duplicates.length + badType.length + small.length + failed.length;
  console.log(problems === 0 ? "\nSONUC: sorun yok." : `\nSONUC: ${problems} sorun.`);
  process.exitCode = problems === 0 ? 0 : 1;
}

main();
