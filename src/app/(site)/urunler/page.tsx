import type { Metadata } from "next";
import { getCatalogEntries } from "@/lib/catalog";
import { prisma } from "@/lib/prisma";
import { ProductCard } from "@/components/product-card";
import { EmptyCategoryState } from "@/components/empty-category-state";
import Link from "next/link";
import { CatalogToolbar } from "@/components/catalog-toolbar";
import { DEFAULT_CATALOG_BANNER_IMAGE } from "@/lib/catalog-banner";
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
      // Urunu olmayan kategori sayfasi "yakinda" ekrani gosterir (ince icerik) -
      // arama motorlari dizinlemesin. Sayim getCatalogEntries ile ayni kapsam.
      const productCount = await prisma.product.count({
        where: {
          status: "PUBLISHED",
          category: { isActive: true, OR: [{ slug: kategori }, { parent: { slug: kategori } }] },
          gender: cinsiyet ? cinsiyet : undefined
        }
      });
      return {
        title: `${title} | Bollmark`,
        description: `Bollmark ${title} koleksiyonunu keşfedin.`,
        ...(productCount === 0 && { robots: { index: false } })
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
  // icin zaten ozel bir ekran var (EmptyCategoryState).
  const hasActiveFilters = countActiveFilters(filters, false) > 0;
  // Urunu olmayan kategori "yakinda" ekranini gosterir. Bu kategori
  // filterCategories'te (yalniz urunu olanlar) bulunamayacagi icin ayrica
  // okunur; banner basligi/breadcrumb ile "haber ver" formu bunu kullanir.
  const showComingSoon = entries.length === 0 && !hasActiveFilters;
  const emptyCategory =
    showComingSoon && kategori
      ? await prisma.category.findUnique({
          where: { slug: kategori, isActive: true },
          select: { id: true, name: true, slug: true, imageUrl: true }
        })
      : null;

  // Bos sonuc durumundaki "Filtreleri temizle" baglantisi - cinsiyet/sirala
  // kalir, kategori dahil tum filtreler kalkar.
  const clearParams = new URLSearchParams(params);
  [...FILTER_PARAM_KEYS, "kategori"].forEach((key) => clearParams.delete(key));
  const clearQuery = clearParams.toString();
  const clearHref = clearQuery ? `/urunler?${clearQuery}` : "/urunler";

  const heading = cinsiyet ? `${cinsiyet} Koleksiyonu` : "Tüm Ürünler";

  // Release'de her koleksiyon sayfasinin ustunde tam genislikte bir banner
  // var ve header saydamlasip banner'in uzerine biniyor (bkz.
  // RELEASE_TEMA_BIREBIR_UYUM_PLANI.md 1 - `header-is-transparent`). Banner
  // her katalog gorunumunde (kategori, cinsiyet koleksiyonu, Tum Urunler)
  // render ediliyor; "banner var mi" karari lib/catalog-banner.ts'te, header
  // da saydamligi ayni yardimciyla belirliyor. Gorsel onceligi: secili
  // kategorinin gercek `imageUrl`'i -> site geneli varsayilan gorsel -> (o da
  // yuklenmezse) altindaki duz bg-ink + gradient.
  const activeCategory = kategori
    ? (filterCategories.find((c) => c.slug === kategori) ?? emptyCategory)
    : null;
  const bannerImageUrl = activeCategory?.imageUrl ?? DEFAULT_CATALOG_BANNER_IMAGE;
  const bannerTitle = activeCategory?.name ?? heading;
  // "ANA SAYFA / [CINSIYET /] KATEGORI" - son parca sayfanin kendisi, link degil.
  const breadcrumb: { label: string; href?: string }[] = [{ label: "Ana Sayfa", href: "/" }];
  if (activeCategory) {
    if (cinsiyet) breadcrumb.push({ label: cinsiyet, href: `/urunler?cinsiyet=${encodeURIComponent(cinsiyet)}` });
    breadcrumb.push({ label: activeCategory.name });
  } else {
    breadcrumb.push({ label: cinsiyet ?? "Tüm Ürünler" });
  }

  return (
    <div className="w-full">
      {/* Release'de olculen degerler (collections/shorts, 1440x900 ve 390x844):
          banner 50svh (450px / 422px) ve header'in alt bosluguna kadar uzaniyor;
          breadcrumb (34px) header'in ~33px altinda, baslik kalan alanda ortali
          (~10-12px asagida). */}
      <div className="relative flex h-[50svh] min-h-[320px] w-full flex-col items-center overflow-hidden bg-ink pb-[72px] pt-[101px] md:pb-24">
        <div className="absolute inset-0 bg-gradient-to-b from-ink to-ink/70" />
        {/* Mega menudeki PromoCard ile ayni sebepten duz <img>: kategori
            imageUrl'i Unsplash/Blob disinda bir kaynaktan da gelebiliyor,
            next/image'in remotePatterns kisitlamasina takilmasin diye.
            Dekoratif (alt=""), LCP icin oncelikli. Release'in siyah-beyaz
            dili icin grayscale + koyu overlay. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={bannerImageUrl}
          alt=""
          fetchPriority="high"
          className="absolute inset-0 h-full w-full object-cover grayscale"
        />
        <div className="absolute inset-0 bg-ink/55" />
        <div className="relative z-10 flex w-full flex-1 flex-col items-center px-4 text-center text-cream">
          <nav aria-label="Sayfa yolu" className="flex h-[34px] items-center">
            <ol className="flex items-center gap-2 text-[10px] uppercase tracking-[1px]">
              {breadcrumb.map((crumb, i) => (
                <li key={crumb.label} className="flex items-center gap-2">
                  {i > 0 && <span aria-hidden="true">/</span>}
                  {crumb.href ? (
                    <Link href={crumb.href} className="underline underline-offset-2 hover:text-cream/70">
                      {crumb.label}
                    </Link>
                  ) : (
                    <span aria-current="page">{crumb.label}</span>
                  )}
                </li>
              ))}
            </ol>
          </nav>
          <div className="flex flex-1 items-center pt-5">
            <h1 className="py-[9.4px] font-display text-[27px] font-normal leading-[27px] tracking-[-1.08px] md:text-[47px] md:leading-[47px] md:tracking-[-1.88px]">
              {bannerTitle}
            </h1>
          </div>
        </div>
      </div>

      {/* Release'in katalog sayfasinda max-width yok: her ekran genisliginde
          tam viewport, sabit 36px yan bosluk (mobilde 16px) - header/mega
          menu ile ayni olcu (bkz. RELEASE_TEMA_BIREBIR_UYUM_PLANI.md 1.1 ve
          2). Ustteki dikey bosluk banner'dan geldigi icin dar (pt-8). */}
      <div className="px-4 pt-8 pb-16 md:px-6 xl:px-9">
      <div>
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
          <EmptyCategoryState
            categoryName={emptyCategory?.name ?? null}
            categoryId={emptyCategory?.id ?? null}
            gender={cinsiyet ?? null}
            suggestions={filterCategories.filter((c) => c.slug !== kategori).slice(0, 5)}
          />
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
