// Tek seferlik betik: ust seviyede (parentId: null) ayni isme sahip kategori
// ciftlerini birlestirir. Kadin/Erkek birlestirme betigi (bkz.
// merge-kadin-erkek-kategoriler.ts) calistiktan sonra, o betikten cikan bazi
// kategoriler (Tisort, Elbise, Gomlek, Bluz) DB'de zaten var olan ayni isimli
// tekil ust kategorilerle isim cakismasi yaratmisti - bu betik o cakismalari
// giderir. Idempotent: cakisan cift bulunamazsa hicbir sey yapmadan cikar.
import "dotenv/config";
import { prisma } from "../src/lib/prisma";

const TR_MAP: Record<string, string> = {
  ş: "s", ç: "c", ğ: "g", ü: "u", ö: "o", ı: "i", İ: "i",
  Ş: "s", Ç: "c", Ğ: "g", Ü: "u", Ö: "o"
};

function slugify(name: string): string {
  return name
    .split("")
    .map((ch) => TR_MAP[ch] ?? ch)
    .join("")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function uniqueSlug(base: string, current: string, usedSlugs: Set<string>): string {
  if (base === current) return current;
  if (!usedSlugs.has(base)) return base;
  let suffix = 2;
  let candidate = `${base}-${suffix}`;
  while (usedSlugs.has(candidate)) {
    suffix++;
    candidate = `${base}-${suffix}`;
  }
  return candidate;
}

async function main() {
  const [tops, allCategories] = await Promise.all([
    prisma.category.findMany({ where: { parentId: null }, orderBy: { createdAt: "asc" } }),
    prisma.category.findMany()
  ]);

  const byName = new Map<string, typeof tops>();
  for (const c of tops) {
    const list = byName.get(c.name) ?? [];
    list.push(c);
    byName.set(c.name, list);
  }

  const usedSlugs = new Set(allCategories.map((c) => c.slug));
  let mergedPairs = 0;
  let movedProducts = 0;

  for (const [name, group] of byName) {
    if (group.length < 2) continue;
    if (group.length > 2) {
      console.warn(`"${name}" icin ${group.length} kategori var, bu betik sadece cift (2'li) cakismalari destekliyor - atlandi.`);
      continue;
    }

    const [a, b] = group;
    const [aCount, bCount] = await Promise.all([
      prisma.product.count({ where: { categoryId: a.id } }),
      prisma.product.count({ where: { categoryId: b.id } })
    ]);

    let canonical = a;
    let duplicate = b;
    if (bCount > aCount || (bCount === aCount && b.createdAt < a.createdAt)) {
      canonical = b;
      duplicate = a;
    }

    usedSlugs.delete(canonical.slug);
    usedSlugs.delete(duplicate.slug);
    const baseSlug = slugify(canonical.name);
    const newSlug = uniqueSlug(baseSlug, canonical.slug, usedSlugs);
    usedSlugs.add(newSlug);

    await prisma.$transaction(async (tx) => {
      const moved = await tx.product.updateMany({
        where: { categoryId: duplicate.id },
        data: { categoryId: canonical.id }
      });
      await tx.categoryKodMapping.updateMany({
        where: { categoryId: duplicate.id },
        data: { categoryId: canonical.id }
      });
      await tx.coupon.updateMany({
        where: { categoryId: duplicate.id },
        data: { categoryId: canonical.id }
      });

      const remaining = await tx.product.count({ where: { categoryId: duplicate.id } });
      if (remaining > 0) {
        throw new Error(`"${duplicate.name}" (${duplicate.id}) kategorisinde taşıma sonrası hâlâ ${remaining} ürün var, silme iptal edildi.`);
      }

      if (newSlug !== canonical.slug) {
        await tx.category.update({ where: { id: canonical.id }, data: { slug: newSlug } });
      }
      await tx.category.delete({ where: { id: duplicate.id } });

      movedProducts += moved.count;
      console.log(
        `Birleştirildi: "${name}" (${a.id} slug=${a.slug}, ${aCount} ürün <-> ${b.id} slug=${b.slug}, ${bCount} ürün) -> kanonik ${canonical.id} (slug: ${newSlug}), ${moved.count} ürün taşındı, "${duplicate.id}" silindi.`
      );
    });

    mergedPairs++;
  }

  const finalCount = await prisma.category.count();
  console.log(`\nTamamlandı. ${mergedPairs} tekrarlı üst kategori çifti birleştirildi (${movedProducts} ürün taşındı).`);
  console.log(`Toplam kategori sayısı: ${allCategories.length} -> ${finalCount}.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
