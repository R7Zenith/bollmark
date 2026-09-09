// Tek seferlik betik: Kadin ve Erkek ust kategorileri altinda ayni isimli alt
// kategorileri (or. Kadin > Tisort ve Erkek > Tisort) tek bir ust-kategorisiz
// kategoride birlestirir. Cinsiyet ayrimi artik Product.gender alaniyla
// yapiliyor, kategori sadece urun tipini temsil ediyor. Aksesuar grubuna
// dokunulmaz. Idempotent: Kadin/Erkek ust kategorileri bulunamazsa (daha once
// calistirilmis ya da hic olusturulmamissa) hicbir sey yapmadan cikar.
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
  const [kadin, erkek] = await Promise.all([
    prisma.category.findFirst({ where: { name: "Kadın", parentId: null } }),
    prisma.category.findFirst({ where: { name: "Erkek", parentId: null } })
  ]);

  if (!kadin || !erkek) {
    console.log("Kadın ve/veya Erkek üst kategorisi bulunamadı - birleştirilecek bir şey yok (muhtemelen zaten çalıştırıldı).");
    return;
  }

  const [kadinChildren, erkekChildren, allCategories] = await Promise.all([
    prisma.category.findMany({ where: { parentId: kadin.id } }),
    prisma.category.findMany({ where: { parentId: erkek.id } }),
    prisma.category.findMany()
  ]);

  const toDelete = new Set<string>();
  const usedSlugs = new Set(allCategories.map((c) => c.slug));

  const erkekByName = new Map(erkekChildren.map((c) => [c.name, c]));
  const handledErkekIds = new Set<string>();

  let mergedPairs = 0;
  let movedProducts = 0;
  let reparentedSolo = 0;

  for (const kChild of kadinChildren) {
    const eChild = erkekByName.get(kChild.name);
    if (!eChild) continue; // esi yok, asagida solo olarak islenecek
    handledErkekIds.add(eChild.id);

    const [kCount, eCount] = await Promise.all([
      prisma.product.count({ where: { categoryId: kChild.id } }),
      prisma.product.count({ where: { categoryId: eChild.id } })
    ]);

    let canonical = kChild;
    let duplicate = eChild;
    let canonicalCount = kCount;
    if (eCount > kCount || (eCount === kCount && eChild.createdAt < kChild.createdAt)) {
      canonical = eChild;
      duplicate = kChild;
      canonicalCount = eCount;
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

      await tx.category.update({
        where: { id: canonical.id },
        data: { parentId: null, slug: newSlug }
      });
      await tx.category.delete({ where: { id: duplicate.id } });

      movedProducts += moved.count;
      console.log(
        `Birleştirildi: "${kChild.name}" (Kadın: ${kCount} ürün, Erkek: ${eCount} ürün) -> kanonik "${canonical.name}" (${canonical.id}, slug: ${newSlug}), ${moved.count} ürün taşındı, "${duplicate.name}" (${duplicate.id}) silindi.`
      );
    });

    toDelete.add(duplicate.id);
    mergedPairs++;
  }

  // Esi olmayan (tek tarafta olan) alt kategoriler: ust kategori seviyesine tasi.
  const soloChildren = [
    ...kadinChildren.filter((c) => !erkekByName.has(c.name)),
    ...erkekChildren.filter((c) => !handledErkekIds.has(c.id))
  ];

  for (const child of soloChildren) {
    const baseSlug = slugify(child.name);
    const newSlug = uniqueSlug(baseSlug, child.slug, usedSlugs);
    usedSlugs.delete(child.slug);
    usedSlugs.add(newSlug);

    await prisma.category.update({
      where: { id: child.id },
      data: { parentId: null, slug: newSlug }
    });
    reparentedSolo++;
    console.log(`Üst kategoriye taşındı: "${child.name}" (${child.id}, slug: ${newSlug}).`);
  }

  // Kadin/Erkek ust kategorileri artik bos olmali - dogrula ve sil.
  for (const top of [kadin, erkek]) {
    const [childCount, productCount] = await Promise.all([
      prisma.category.count({ where: { parentId: top.id } }),
      prisma.product.count({ where: { categoryId: top.id } })
    ]);
    if (childCount > 0 || productCount > 0) {
      throw new Error(`"${top.name}" (${top.id}) hâlâ ${childCount} alt kategori / ${productCount} ürün içeriyor, silinmedi.`);
    }
    await prisma.category.delete({ where: { id: top.id } });
    console.log(`Silindi: üst kategori "${top.name}" (${top.id}).`);
  }

  const finalCount = await prisma.category.count();
  console.log(
    `\nTamamlandı. ${mergedPairs} çift birleştirildi (${movedProducts} ürün taşındı), ${reparentedSolo} tek taraflı kategori üst seviyeye taşındı, 2 üst kategori (Kadın, Erkek) silindi.`
  );
  console.log(`Toplam kategori sayısı: ${allCategories.length} -> ${finalCount}.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
