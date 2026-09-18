import type { Metadata } from "next";
import { getCatalogEntries } from "@/lib/catalog";
import { prisma } from "@/lib/prisma";
import { ProductCard } from "@/components/product-card";
import Link from "next/link";
import { CatalogToolbar } from "@/components/catalog-toolbar";
import {
  FILTER_PARAM_KEYS,
  applyCatalogFilters,
  buildCatalogFacets,
  countActiveFilters,
  parseCatalogFilters,
  toURLSearchParams
} from "@/lib/catalog-filters";
import { getActiveAutomaticPercentCampaigns, resolveProductDisplayPrice } from "@/lib/coupons";
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
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const params = toURLSearchParams(query);
  const kategori = params.get("kategori") || undefined;
  const cinsiyet = params.get("cinsiyet") || undefined;
  const sirala = params.get("sirala") || undefined;
  const filters = parseCatalogFilters(params);

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
      select: { name: true, slug: true, imageUrl: true }
    })
  ]);
  // Cekmece secenekleri filtrelenmemis (kategori/cinsiyet kapsamindaki)
  // girislerden uretilir, yoksa bir renk secince diger renkler kaybolurdu.
  const facets = buildCatalogFacets(rawEntries);
  const entries = sortEntries(applyCatalogFilters(rawEntries, filters), sirala);
  // Kategori burada sayilmiyor: kategori+cinsiyet kombinasyonunun bos olmasi
  // icin zaten ozel bir mesaj var (emptyMessage).
  const hasActiveFilters = countActiveFilters(filters, false) > 0;

  // Bos sonuc durumundaki "Filtreleri temizle" baglantisi - cinsiyet/sirala
  // kalir, kategori dahil tum filtreler kalkar.
  const clearParams = new URLSearchParams(params);
  [...FILTER_PARAM_KEYS, "kategori"].forEach((key) => clearParams.delete(key));
  const clearQuery = clearParams.toString();
  const clearHref = clearQuery ? `/urunler?${clearQuery}` : "/urunler";

  const heading = cinsiyet ? `${cinsiyet} Koleksiyonu` : "Tüm Ürünler";
  const emptyMessage = cinsiyet
    ? `${cinsiyet} koleksiyonunda bu kategoride henüz ürün bulunmuyor.`
    : "Bu kategoride henüz ürün bulunmuyor.";

  // Release'de her koleksiyon sayfasinin ustunde tam genislikte bir banner
  // var, banner varken header saydamlasip banner'in uzerine biniyor (bkz.
  // RELEASE_TEMA_BIREBIR_UYUM_PLANI.md 1 - `header-is-transparent`). Bunun
  // icin uydurma bir kampanya gorseli eklemek yerine, secili kategorinin
  // zaten var olan (mega menudeki promosyon kartlariyla ayni) gercek
  // `imageUrl`'i kullaniliyor - kategori bir gorsele sahip degilse banner hic
  // render edilmiyor, sayfa eskisi gibi duz baslikla aciliyor. SiteHeader'daki
  // saydamlik kontrolu de (bkz. site-header.tsx) tam olarak ayni kosulu
  // kontrol ediyor, ikisi birbirinden bagimsiz kaymasin diye.
  const activeCategory = kategori ? filterCategories.find((c) => c.slug === kategori) : null;
  const bannerImageUrl = activeCategory?.imageUrl ?? null;

  return (
    <div className="w-full">
      {bannerImageUrl && (
        <div className="relative flex h-[50svh] min-h-[320px] w-full items-center justify-center overflow-hidden bg-ink">
          {/* Mega menudeki PromoCard ile ayni sebepten duz <img>: kategori
              imageUrl'i Unsplash/Blob disinda bir kaynaktan da gelebiliyor,
              next/image'in remotePatterns kisitlamasina takilmasin diye. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={bannerImageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-ink/35" />
          <div className="relative z-10 text-center text-cream">
            {cinsiyet && (
              <p className="text-xs uppercase tracking-widest2 text-cream/70">{cinsiyet}</p>
            )}
            <h1 className="mt-2 font-display text-5xl font-light">{activeCategory!.name}</h1>
          </div>
        </div>
      )}

      {/* Release'in katalog sayfasinda max-width yok: her ekran genisliginde
          tam viewport, sabit 36px yan bosluk (mobilde 16px) - header/mega
          menu ile ayni olcu (bkz. RELEASE_TEMA_BIREBIR_UYUM_PLANI.md 1.1 ve
          2). Banner varken ustteki dikey bosluk banner'dan geldigi icin
          daralttik (py-16 -> pt-8 pb-16). */}
      <div className={`px-4 md:px-6 xl:px-9 ${bannerImageUrl ? "pt-8 pb-16" : "py-16"}`}>
        {!bannerImageUrl && (
          <>
            <p className="text-xs uppercase tracking-widest2 text-ink/50">
              Tüm Ürünler {cinsiyet ? `— ${cinsiyet}` : ""}
            </p>
            <h1 className="mt-2 font-display text-5xl font-light">{heading}</h1>
          </>
        )}

      <div className="mt-8">
        <CatalogToolbar
          categories={filterCategories}
          activeCategory={kategori ?? null}
          activeSort={sirala ?? ""}
          count={entries.length}
          facets={facets}
          filters={filters}
        />
      </div>

      {entries.length === 0 ? (
        hasActiveFilters ? (
          <div className="mt-16 flex flex-col items-center text-center">
            <p className="text-2xl font-normal tracking-[-0.5px]">Sonuç bulunamadı</p>
            <p className="mt-3 text-sm text-ink/60">Seçtiğiniz filtrelere uyan ürün yok.</p>
            <Link
              href={clearHref}
              className="mt-8 flex h-[44px] items-center justify-center rounded-[50px] border border-ink px-8 text-[10px] uppercase tracking-[1px] text-ink transition duration-300 hover:bg-ink hover:text-cream"
            >
              Filtreleri Temizle
            </Link>
          </div>
        ) : (
          <p className="mt-10 text-ink/60">{emptyMessage}</p>
        )
      ) : (
        // Mobilde gorseller ekran kenarina yapisik olsun diye grid ust
        // konteynerin px-4'unu -mx-4 ile iptal ediyor (bkz.
        // MOBIL_KATALOG_GORSEL_BOSLUK_PLANI.md); masaustunde mx-0 ile eski
        // hale donuyor. Sutunlar arasi bosluk mobilde ince (gap-x-0.5),
        // satirlar arasi kart metni icin daha genis (gap-y-3); masaustunde
        // Release'de olculmus gercek deger olan gap-6 korunuyor.
        <div className="mt-8 -mx-4 grid grid-cols-2 gap-x-0.5 gap-y-3 md:mx-0 md:grid-cols-4 md:gap-6">
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
                secondImage: entry.secondImage,
                colorLabel: entry.colorLabel,
                priceResolution: resolveProductDisplayPrice(automaticCampaigns, entry),
                outOfStock: entry.outOfStock,
                lowStockCount: entry.lowStockCount,
                isNew: entry.isNew,
                quickAddVariants: entry.quickAddVariants,
                colors: entry.colors
              }}
            />
          ))}
        </div>
      )}
      </div>
    </div>
  );
}
