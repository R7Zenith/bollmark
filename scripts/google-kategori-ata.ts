// Tek seferlik script (bkz. SEO_TEKNIK_DENETIM_VE_PLAN.md 2.9): mevcut
// kategorilere Google urun kategorisi (googleCategoryId) ilk atamasini yapar -
// INITIAL_GOOGLE_CATEGORY_BY_SLUG'dan. Zaten degeri olan kategoriye dokunmaz;
// sonrasi admin kategori sayfasindan degistirilir. Varsayilan kuru calisma.
//   npx tsx scripts/google-kategori-ata.ts           (sadece listeler)
//   npx tsx scripts/google-kategori-ata.ts --apply   (DB'ye yazar)
import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { GOOGLE_CATEGORIES, INITIAL_GOOGLE_CATEGORY_BY_SLUG } from "../src/lib/google-categories";

async function main() {
  const apply = process.argv.includes("--apply");
  const categories = await prisma.category.findMany({
    select: { id: true, name: true, slug: true, googleCategoryId: true },
    orderBy: { name: "asc" }
  });
  for (const c of categories) {
    const target = INITIAL_GOOGLE_CATEGORY_BY_SLUG[c.slug];
    if (c.googleCategoryId) {
      console.log(`= ${c.name}: zaten ${c.googleCategoryId}, atlandi`);
    } else if (!target) {
      console.log(`- ${c.name} (${c.slug}): eslesme yok, ust kategoriden/genel 166 kullanilacak`);
    } else {
      const label = GOOGLE_CATEGORIES.find((g) => g.id === target)?.label ?? String(target);
      console.log(`${apply ? "✓" : "·"} ${c.name}: ${target} ${label}`);
      if (apply) await prisma.category.update({ where: { id: c.id }, data: { googleCategoryId: target } });
    }
  }
  if (!apply) console.log("\nKuru calisma - yazmak icin --apply ekleyin.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
