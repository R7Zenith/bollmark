import { cache } from "react";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { catalogHref, genderWhere } from "@/lib/catalog-url";
import { pickCoverImage } from "@/lib/catalog";
import type { MegaMenuCard } from "@/lib/mega-menu-cards";

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
  // Aksesuar panelinin sagindaki kartlar: Kadin/Erkek'teki gibi sabit gorsel
  // degil, kategorinin en yeni yayindaki urununun fotografi.
  aksesuarCards: MegaMenuCard[];
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

const AKSESUAR_CARD_CATEGORIES = [
  { slug: "canta", title: "Çanta" },
  { slug: "parfum", title: "Parfüm" }
];

async function getAksesuarCards(): Promise<MegaMenuCard[]> {
  const cards = await Promise.all(
    AKSESUAR_CARD_CATEGORIES.map(async ({ slug, title }) => {
      const product = await prisma.product.findFirst({
        where: {
          status: "PUBLISHED",
          category: { slug },
          OR: [{ images: { some: {} } }, { optionImages: { some: {} } }]
        },
        orderBy: { createdAt: "desc" },
        select: {
          images: { orderBy: { position: "asc" }, take: 1, select: { url: true } },
          optionImages: { orderBy: { position: "asc" }, select: { url: true, isCover: true } }
        }
      });
      const image = product?.images[0]?.url ?? (product && pickCoverImage(product.optionImages)?.url);
      if (!image) return null;
      return { image, alt: `${title} koleksiyonu`, label: "YENİ GELENLER", title, href: catalogHref({ category: slug }) };
    })
  );
  return cards.filter((card) => card !== null);
}

// DB cagrilari onbellekte; urun/kategori degisince revalidateCatalog()
// (lib/revalidate-catalog.ts) gecersiz kilar, revalidate 3600 emniyet agi.
// Ayri etiket: menu layout'ta oldugu icin etiketi TUM vitrin sayfalarina
// yayilir. CATALOG_TAG'i paylassaydi her Vega stok degisimi tum urun
// sayfalarini silerdi (bkz. NEON_TRANSFER_AZALTMA_PLANI.md oneri 1).
export const MENU_TAG = "menu";
const cacheOptions = { tags: [MENU_TAG], revalidate: 3600 };
const getCachedGenderCategories = unstable_cache(getGenderCategories, ["menu-gender-categories"], cacheOptions);
const getCachedAksesuarCategories = unstable_cache(getAksesuarCategories, ["menu-aksesuar-categories"], cacheOptions);
const getCachedAksesuarCards = unstable_cache(getAksesuarCards, ["menu-aksesuar-cards"], cacheOptions);

export const getMegaMenuData = cache(async (): Promise<MegaMenuData> => {
  const [kadin, erkek, kizCocuk, erkekCocuk, cocuk, aksesuar, aksesuarCards] = await Promise.all([
    getCachedGenderCategories("Kadın"),
    getCachedGenderCategories("Erkek"),
    getCachedGenderCategories("Kız Çocuk"),
    getCachedGenderCategories("Erkek Çocuk"),
    getCachedGenderCategories("Çocuk"),
    getCachedAksesuarCategories(),
    getCachedAksesuarCards()
  ]);
  return { kadin, erkek, kizCocuk, erkekCocuk, cocuk, aksesuar, aksesuarCards };
});
