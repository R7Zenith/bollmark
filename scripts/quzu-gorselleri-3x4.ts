// Tek seferlik script: "Linkle Ekle" 3:4 dolgusu eklenmeden ONCE yuklenmis Quzu
// gorsellerini (2:3, R2'de) 3:4'e tamamlar. Her gorsel icin: R2'den indir -> padToCardRatio
// -> compressImage -> R2'ye YENI dosya olarak yukle -> DB satirinin url'ini degistir.
// Zaten 3:4 veya daha genis olanlar atlanir. Eski dosyalar SILINMEZ (canli sitenin
// onbellegindeki sayfalar eski adresi gosteriyor olabilir).
//
//   npx tsx scripts/quzu-gorselleri-3x4.ts            -> sadece listeler, hicbir sey yazmaz
//   npx tsx scripts/quzu-gorselleri-3x4.ts --uygula   -> R2'ye ve DB'ye yazar
import { config } from "dotenv";
config({ path: ".env" });
config({ path: ".env.local", override: true });
import sharp from "sharp";

async function main() {
  const apply = process.argv.includes("--uygula");
  const { prisma } = await import("../src/lib/prisma");
  const { padToCardRatio } = await import("../src/lib/link-images");
  const { compressImage } = await import("../src/lib/image-compress");
  const { uploadImage, isR2Url } = await import("../src/lib/image-storage");

  const rows = await prisma.productOptionImage.findMany({
    where: { product: { brand: { slug: "quzu" } } },
    select: { id: true, url: true, product: { select: { code: true, name: true } }, value: { select: { value: true } } },
    orderBy: [{ productId: "asc" }, { position: "asc" }]
  });

  let changed = 0;
  let skipped = 0;
  for (const row of rows) {
    const label = `${row.product.code} ${row.product.name} / ${row.value.value}`;
    if (!isR2Url(row.url)) {
      console.log(`ATLANDI (R2 degil): ${label}`);
      skipped++;
      continue;
    }
    const res = await fetch(row.url);
    if (!res.ok) {
      console.log(`ATLANDI (indirilemedi ${res.status}): ${label}`);
      skipped++;
      continue;
    }
    const original = Buffer.from(await res.arrayBuffer());
    const padded = await padToCardRatio(original);
    if (padded === original) {
      console.log(`ATLANDI (zaten 3:4): ${label}`);
      skipped++;
      continue;
    }
    const before = await sharp(original).metadata();
    const after = await sharp(padded).metadata();
    if (!apply) {
      console.log(`DEGISECEK: ${label}  ${before.width}x${before.height} -> ${after.width}x${after.height}`);
      changed++;
      continue;
    }
    const nameHint = row.url.split("/").pop()!.replace(/-[0-9a-f]{8}\.\w+$/, "");
    const url = await uploadImage({ folder: "link-import", nameHint: `${nameHint}-3x4`, ...(await compressImage(padded)) });
    await prisma.productOptionImage.update({ where: { id: row.id }, data: { url } });
    console.log(`DEGISTI: ${label}  -> ${url}`);
    changed++;
  }
  console.log(`\nToplam ${rows.length} gorsel: ${changed} ${apply ? "degisti" : "degisecek"}, ${skipped} atlandi.${apply ? "" : " Yazmak icin --uygula ekleyin."}`);
  await prisma.$disconnect();
}

main();
