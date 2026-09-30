// Tek seferlik script (bkz. SEO_FAZ3_KATEGORI_URL_PLANI.md 3.10): Turkce
// karakterli eski kategori slug'larini ASCII'ye cevirir (parfüm -> parfum).
// Eski ?kategori= adresleri proxy.ts'te LEGACY_CATEGORY_SLUGS ile yeni slug'a
// 301 alir. Varsayilan kuru calisma; yazmak icin --apply.
//   npx tsx scripts/kategori-slug-ascii.ts           (sadece listeler)
//   npx tsx scripts/kategori-slug-ascii.ts --apply   (DB'ye yazar)
import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { LEGACY_CATEGORY_SLUGS } from "../src/lib/catalog-url";

async function main() {
  const apply = process.argv.includes("--apply");
  for (const [oldSlug, newSlug] of Object.entries(LEGACY_CATEGORY_SLUGS)) {
    const [current, taken] = await Promise.all([
      prisma.category.findUnique({ where: { slug: oldSlug }, select: { id: true, name: true } }),
      prisma.category.findUnique({ where: { slug: newSlug }, select: { id: true } })
    ]);
    if (!current) {
      console.log(`- ${oldSlug}: bulunamadi (zaten cevrilmis olabilir), atlandi`);
      continue;
    }
    if (taken) {
      console.log(`! ${oldSlug} -> ${newSlug}: hedef slug baska kategoride, atlandi`);
      continue;
    }
    console.log(`${apply ? "✓" : "·"} ${current.name}: ${oldSlug} -> ${newSlug}`);
    if (apply) await prisma.category.update({ where: { id: current.id }, data: { slug: newSlug } });
  }
  if (!apply) console.log("\nKuru calisma - yazmak icin --apply ekleyin.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
