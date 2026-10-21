import { cache } from "react";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { CATALOG_TAG } from "@/lib/catalog";
import { genderWhere } from "@/lib/catalog-url";

export type MenuCategory = { id: string; name: string; slug: string; imageUrl: string | null };

export type MegaMenuData = {
  kadin: MenuCategory[];
  erkek: MenuCategory[];
  // Cocuk paneli: Kiz/Erkek Cocuk sutunlari; `cocuk` tum cocuk urunlerinin
  // kategorileri (bos ise Cocuk sekmesi gizlenir).
  kizCocuk: MenuCategory[];
  erkekCocuk: MenuCategory[];
  cocuk: MenuCategory[];
  aksesuar: MenuCategory[];
};

async function getGenderCategories(genderLabel: string): Promise<MenuCategory[]> {
  const categories = await prisma.category.findMany({
    where: {
      isActive: true,
      products: { some: { status: "PUBLISHED", gender: genderWhere(genderLabel) } }
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true, slug: true, imageUrl: true }
  });
  return categories;
}

async function getAksesuarCategories(): Promise<MenuCategory[]> {
  const aksesuar = await prisma.category.findFirst({
    where: { parentId: null, slug: "aksesuar" },
    select: {
      children: {
        where: { isActive: true },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        select: { id: true, name: true, slug: true, imageUrl: true }
      }
    }
  });
  return aksesuar?.children ?? [];
}

// DB cagrilari onbellekte; urun/kategori degisince revalidateCatalog()
// (lib/revalidate-catalog.ts) gecersiz kilar, revalidate 3600 emniyet agi.
const cacheOptions = { tags: [CATALOG_TAG], revalidate: 3600 };
const getCachedGenderCategories = unstable_cache(getGenderCategories, ["menu-gender-categories"], cacheOptions);
const getCachedAksesuarCategories = unstable_cache(getAksesuarCategories, ["menu-aksesuar-categories"], cacheOptions);

export const getMegaMenuData = cache(async (): Promise<MegaMenuData> => {
  const [kadin, erkek, kizCocuk, erkekCocuk, cocuk, aksesuar] = await Promise.all([
    getCachedGenderCategories("Kadın"),
    getCachedGenderCategories("Erkek"),
    getCachedGenderCategories("Kız Çocuk"),
    getCachedGenderCategories("Erkek Çocuk"),
    getCachedGenderCategories("Çocuk"),
    getCachedAksesuarCategories()
  ]);
  return { kadin, erkek, kizCocuk, erkekCocuk, cocuk, aksesuar };
});
