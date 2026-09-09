// Tek seferlik seed betigi: uc ana kategori (Kadin, Erkek, Aksesuar) ve bunlarin
// alt kategorilerini olusturur. Idempotent - ayni isim + parent zaten varsa atlanir,
// bu yuzden betik birden fazla kez calistirilabilir.
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

type CategorySeed = {
  name: string;
  slug: string;
  children: string[];
};

const SEED: CategorySeed[] = [
  {
    name: "Kadın",
    slug: "kadin",
    children: [
      "Elbise", "Tişört", "Gömlek", "Bluz", "Pantolon", "Kot Pantolon", "Etek", "Şort",
      "Sweatshirt", "Kazak & Süveter", "Hırka", "Ceket", "Blazer Ceket", "Mont & Kaban",
      "Trençkot", "Yelek", "Tulum", "Tayt", "Eşofman", "Abiye & Davetiye", "Mayo & Bikini",
      "İç Giyim", "Pijama & Gecelik"
    ]
  },
  {
    name: "Erkek",
    slug: "erkek",
    children: [
      "Tişört", "Polo Yaka", "Gömlek", "Pantolon", "Kot Pantolon", "Şort & Bermuda",
      "Sweatshirt", "Kazak", "Hırka", "Ceket", "Blazer", "Mont & Kaban", "Atlet", "Boxer",
      "Eşofman"
    ]
  },
  {
    name: "Aksesuar",
    slug: "aksesuar",
    children: [
      "Çanta", "Ayakkabı", "Şapka & Bere", "Kemer", "Şal & Atkı", "Takı & Bijuteri",
      "Çorap", "Saç Aksesuarları"
    ]
  }
];

async function main() {
  const existing = await prisma.category.findMany({ select: { slug: true } });
  const usedSlugs = new Set(existing.map((c) => c.slug));

  let created = 0;
  let skipped = 0;

  for (let i = 0; i < SEED.length; i++) {
    const top = SEED[i];
    const topSortOrder = i * 10;

    let parent = await prisma.category.findFirst({
      where: { name: top.name, parentId: null }
    });

    if (parent) {
      skipped++;
    } else {
      parent = await prisma.category.create({
        data: {
          name: top.name,
          slug: top.slug,
          parentId: null,
          isActive: true,
          sortOrder: topSortOrder
        }
      });
      usedSlugs.add(top.slug);
      created++;
    }

    for (let j = 0; j < top.children.length; j++) {
      const childName = top.children[j];
      const childSortOrder = j * 10;

      const existingChild = await prisma.category.findFirst({
        where: { name: childName, parentId: parent.id }
      });

      if (existingChild) {
        skipped++;
        continue;
      }

      let childSlug = slugify(childName);
      if (usedSlugs.has(childSlug)) {
        childSlug = slugify(`${top.name} ${childName}`);
      }
      // Yine de cakisiyorsa (beklenmedik durum) numara ekleyerek benzersiz yap.
      let suffix = 2;
      const baseSlug = childSlug;
      while (usedSlugs.has(childSlug)) {
        childSlug = `${baseSlug}-${suffix}`;
        suffix++;
      }

      await prisma.category.create({
        data: {
          name: childName,
          slug: childSlug,
          parentId: parent.id,
          isActive: true,
          sortOrder: childSortOrder
        }
      });
      usedSlugs.add(childSlug);
      created++;
    }
  }

  console.log(`Tamamlandi. ${created} kategori eklendi, ${skipped} kategori zaten vardi (atlandi).`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
