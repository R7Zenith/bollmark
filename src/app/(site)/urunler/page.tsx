import type { Metadata } from "next";
import { getCatalogEntries } from "@/lib/catalog";
import { prisma } from "@/lib/prisma";
import { ProductCard } from "@/components/product-card";
import { CatalogToolbar } from "@/components/catalog-toolbar";
import { getActiveAutomaticPercentCampaigns, matchAutomaticDiscount } from "@/lib/coupons";
import type { CatalogEntry } from "@/lib/catalog";

const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1445205170230-053b83016050?w=800";

// Ust cubuktaki siralama secimi. Stogu biten girisler her durumda listenin
// sonunda kalir (bkz. lib/catalog.ts) - siralama yalnizca stokta olanlar
// arasinda uygulanir, yoksa "fiyat: dusukten yuksege" secildiginde satilamayan
// urunler basa cikardi.
function sortEntries(entries: CatalogEntry[], sort?: string): CatalogEntry[] {
  if (!sort) return entries;
  const comparators: Record<string, (a: CatalogEntry, b: CatalogEntry) => number> = {
    "fiyat-artan": (a, b) => a.priceCents - b.priceCents,
    "fiyat-azalan": (a, b) => b.priceCents - a.priceCents,
    isim: (a, b) => a.name.localeCompare(b.name, "tr")
  };
  const compare = comparators[sort];
  if (!compare) return entries;
  return [...entries].sort(
    (a, b) => Number(a.outOfStock) - Number(b.outOfStock) || compare(a, b)
  );
}

export async function generateMetadata({
  searchParams
}: {
  searchParams: Promise<{ kategori?: string; cinsiyet?: string }>;
}): Promise<Metadata> {
  const { kategori, cinsiyet } = await searchParams;
  if (kategori) {
    const category = await prisma.category.findUnique({
      where: { slug: kategori, isActive: true },
      select: { name: true }
    });
    if (category) {
      const title = cinsiyet ? `${cinsiyet} ${category.name}` : category.name;
      return {
        title: `${title} | Bollmark`,
        description: `Bollmark ${title} koleksiyonunu keşfedin.`
      };
    }
  }
  if (cinsiyet) {
    return {
      title: `${cinsiyet} Koleksiyonu | Bollmark`,
      description: `Bollmark ${cinsiyet} koleksiyonunu keşfedin.`
    };
  }
  return {
    title: "Tüm Ürünler | Bollmark",
    description: "Bollmark'ın özenle seçilmiş kumaşlarla tasarlanan tüm ürünlerini keşfedin."
  };
}

export default async function ProductsPage({
  searchParams
}: {
  searchParams: Promise<{ kategori?: string; cinsiyet?: string; sirala?: string }>;
}) {
  const { kategori, cinsiyet, sirala } = await searchParams;

  // Birden fazla rengi olan urunler burada renk basina ayri bir giris olarak
  // gelir (bkz. lib/catalog.ts getCatalogEntries) - musteri kataloga bakarken
  // her rengi urune tiklamadan ayri bir urunmus gibi gorur.
  const [rawEntries, automaticCampaigns, filterCategories] = await Promise.all([
    getCatalogEntries(kategori, { genderLabel: cinsiyet }),
    getActiveAutomaticPercentCampaigns(prisma),
    // Ust cubuktaki "Filtrele" listesi - yalnizca su anki cinsiyet kapsaminda
    // gercekten yayinda urunu olan kategoriler (bos filtre secenegi gosterilmez).
    prisma.category.findMany({
      where: {
        isActive: true,
        products: { some: { status: "PUBLISHED", gender: cinsiyet ? cinsiyet : undefined } }
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { name: true, slug: true }
    })
  ]);
  const entries = sortEntries(rawEntries, sirala);

  const heading = cinsiyet ? `${cinsiyet} Koleksiyonu` : "Tüm Ürünler";
  const emptyMessage = cinsiyet
    ? `${cinsiyet} koleksiyonunda bu kategoride henüz ürün bulunmuyor.`
    : "Bu kategoride henüz ürün bulunmuyor.";

  return (
    // Release'in katalog sayfasinda max-width yok: her ekran genisliginde tam
    // viewport, sabit 36px yan bosluk (mobilde 16px) - header/mega menu ile
    // ayni olcu (bkz. RELEASE_TEMA_BIREBIR_UYUM_PLANI.md 1.1 ve 2).
    <div className="w-full px-4 py-16 md:px-6 xl:px-9">
      <p className="text-xs uppercase tracking-widest2 text-ink/50">
        Tüm Ürünler {cinsiyet ? `— ${cinsiyet}` : ""}
      </p>
      <h1 className="mt-2 font-display text-5xl font-light">{heading}</h1>

      <div className="mt-8">
        <CatalogToolbar
          categories={filterCategories}
          activeCategory={kategori ?? null}
          activeSort={sirala ?? ""}
          count={entries.length}
        />
      </div>

      {entries.length === 0 ? (
        <p className="mt-10 text-ink/60">{emptyMessage}</p>
      ) : (
        // Kartlar arasi bosluk Release'de 32px, masaustunde 4 sutun (bkz. 2).
        <div className="mt-8 grid grid-cols-2 gap-8 md:grid-cols-4">
          {entries.map((entry) => (
            <ProductCard
              key={`${entry.productId}-${entry.colorLabel ?? "tek"}`}
              product={{
                productId: entry.productId,
                slug: entry.slug,
                name: entry.name,
                priceCents: entry.priceCents,
                compareAtCents: entry.compareAtCents,
                image: entry.image ?? FALLBACK_IMAGE,
                colorLabel: entry.colorLabel,
                automaticDiscountPercent: matchAutomaticDiscount(automaticCampaigns, entry)?.percent ?? null,
                outOfStock: entry.outOfStock,
                quickAddVariant: entry.quickAddVariant
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
