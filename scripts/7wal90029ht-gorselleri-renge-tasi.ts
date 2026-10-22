// Tek seferlik veri duzeltmesi: 7WAL90029HT urununde renk fotograflari yanlislikla
// ana gorsellere (ProductImage) yuklenmisti. Urunun tek rengi (GRI CIZGILI) oldugu
// icin hepsi o rengin galerisine (ProductOptionImage) ayni sirayla kopyalanir,
// ana gorseller bosaltilir - Koton aktarimli diger urunlerle ayni yapi. Depodaki
// (R2) dosyalara dokunulmaz, sadece DB kayitlari tasinir. Galeride zaten olan
// URL tekrar eklenmez. Uygulamadan once mevcut durum scripts/output/ altina
// JSON olarak yedeklenir.
//
//   npx tsx scripts/7wal90029ht-gorselleri-renge-tasi.ts            -> dry-run, hicbir sey yazmaz
//   npx tsx scripts/7wal90029ht-gorselleri-renge-tasi.ts --uygula   -> yedek alir, tek transaction'da yazar
import { config } from "dotenv";
config({ path: ".env" });
config({ path: ".env.local", override: true });
import { mkdirSync, writeFileSync } from "node:fs";

const PRODUCT_CODE = "7WAL90029HT";
const COLOR_VALUE_ID = "cmvi6823m005006ji9b55acc5"; // Renk = GRI CIZGILI

async function main() {
  const apply = process.argv.includes("--uygula");
  const { prisma } = await import("../src/lib/prisma");

  const products = await prisma.product.findMany({
    where: { code: PRODUCT_CODE },
    include: {
      images: { orderBy: { position: "asc" } },
      optionImages: { orderBy: [{ valueId: "asc" }, { position: "asc" }] },
      variants: { select: { options: { select: { valueId: true, value: { select: { value: true } } } } } }
    }
  });
  if (products.length !== 1) throw new Error(`${PRODUCT_CODE} icin 1 urun bekleniyordu, ${products.length} bulundu`);
  const product = products[0];

  const colorOption = product.variants.flatMap((v) => v.options).find((o) => o.valueId === COLOR_VALUE_ID);
  if (!colorOption) throw new Error(`Renk ${COLOR_VALUE_ID} bu urunun varyantlarinda yok`);
  const colorLabel = colorOption.value.value;

  const existingGallery = product.optionImages.filter((img) => img.valueId === COLOR_VALUE_ID);
  const existingUrls = new Set(existingGallery.map((img) => img.url));
  const toAdd = product.images.filter((img) => !existingUrls.has(img.url));
  const startPosition = existingGallery.reduce((max, img) => Math.max(max, img.position + 1), 0);
  const newRows = toAdd.map((img, i) => ({
    productId: product.id,
    valueId: COLOR_VALUE_ID,
    url: img.url,
    alt: `${product.name} - ${colorLabel}`,
    position: startPosition + i
  }));

  console.log(`Urun: ${product.code} ${product.name} (${product.id})`);
  console.log(`Hedef renk: ${colorLabel} (${COLOR_VALUE_ID}), mevcut galeri: ${existingGallery.length} gorsel`);
  console.log(`Ana gorsel: ${product.images.length}`);
  for (const img of product.images) {
    const skip = existingUrls.has(img.url);
    console.log(`  [${img.position}] ${img.url} -> ${skip ? "galeride zaten var, eklenmeyecek" : "galeriye eklenecek"}`);
  }
  console.log(`Galeriye eklenecek: ${newRows.length}, silinecek ana gorsel kaydi: ${product.images.length}`);
  for (const row of newRows) console.log(`  + pos ${row.position} alt="${row.alt}" ${row.url}`);

  if (!apply) {
    console.log("\nDry-run - hicbir sey yazilmadi. Uygulamak icin --uygula ekleyin.");
    await prisma.$disconnect();
    return;
  }

  mkdirSync("scripts/output", { recursive: true });
  const backupPath = `scripts/output/7wal90029ht-gorsel-yedek-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  writeFileSync(
    backupPath,
    JSON.stringify({ productId: product.id, images: product.images, optionImages: product.optionImages }, null, 2)
  );
  console.log(`\nYedek yazildi: ${backupPath}`);

  await prisma.$transaction(async (tx) => {
    if (newRows.length > 0) await tx.productOptionImage.createMany({ data: newRows });
    await tx.productImage.deleteMany({ where: { productId: product.id, id: { in: product.images.map((img) => img.id) } } });
  });
  console.log("Uygulandi.");
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
