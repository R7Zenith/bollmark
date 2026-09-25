import type { Metadata } from "next";
import { firstImageUrl } from "@/lib/catalog";
import { prisma } from "@/lib/prisma";
import { EmptyCategoryState } from "@/components/empty-category-state";
import Link from "next/link";
import { CatalogToolbar } from "@/components/catalog-toolbar";
import { CatalogGrid } from "@/components/catalog-grid";
import { DEFAULT_CATALOG_BANNER_IMAGE } from "@/lib/catalog-banner";
import {
  CATALOG_PAGE_SIZE,
  CATALOG_SHOW_PARAM,
  FILTER_PARAM_KEYS,
  toURLSearchParams
} from "@/lib/catalog-filters";
import { getCatalogListing, parseSearchQuery, toCatalogCardProps } from "@/lib/catalog-listing";

async function withSampleProductImages(
  categories: { name: string; slug: string; imageUrl: string | null }[],
  gender?: string
) {
  if (categories.length === 0) return [];
  const products = await prisma.product.findMany({
    where: {
      status: "PUBLISHED",
      category: { slug: { in: categories.map((c) => c.slug) } },
      gender: gender ? gender : undefined
    },
    orderBy: { createdAt: "desc" },
    select: {
      category: { select: { slug: true } },
      images: { orderBy: { position: "asc" }, take: 1, select: { url: true } },
      // Fotograflar cogunlukla renk (optionImages) altinda tutuluyor.
      optionImages: { orderBy: [{ isCover: "desc" }, { position: "asc" }], take: 1, select: { url: true } }
    }
  });
  return categories.map((c) => ({
    ...c,
    imageUrl:
      products
        .filter((p) => p.category?.slug === c.slug)
        .map((p) => firstImageUrl(p))
        .find(Boolean) ?? c.imageUrl
  }));
}

export async function generateMetadata({
  searchParams
}: {
  searchParams: Promise<{ kategori?: string; cinsiyet?: string; ara?: string | string[] }>;
}): Promise<Metadata> {
  const { kategori, cinsiyet, ara: rawAra } = await searchParams;
  const ara = parseSearchQuery(Array.isArray(rawAra) ? rawAra[0] : rawAra);
  // Arama sonuc sayfalari dizinlenmesin (ince/tekrarlayan icerik).
  if (ara) {
    return { title: `“${ara}” araması | Bollmark`, robots: { index: false, follow: true } };
  }
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
  const {
    entries,
    facets,
    filters,
    hasActiveFilters,
    kategori,
    cinsiyet,
    sirala,
    ara,
    automaticCampaigns,
    filterCategories
  } = await getCatalogListing(params);

  // ?goster=N: kac kartin acik oldugu ("Daha Fazla Goster", bkz.
  // components/catalog-grid.tsx). Ustteki 24'un katina yuvarlanir (son parti
  // yarimsa ?goster=131 gibi degerler 120'ye dusmesin); en az 24, en fazla
  // toplam giris sayisi.
  const requestedShow = Number(params.get(CATALOG_SHOW_PARAM));
  const show = Math.min(
    entries.length,
    Number.isFinite(requestedShow)
      ? Math.max(CATALOG_PAGE_SIZE, Math.ceil(requestedShow / CATALOG_PAGE_SIZE) * CATALOG_PAGE_SIZE)
      : CATALOG_PAGE_SIZE
  );
  const gridParams = new URLSearchParams(params);
  gridParams.delete(CATALOG_SHOW_PARAM);
  const gridQuery = gridParams.toString();
  // Urunu olmayan kategori "yakinda" ekranini gosterir. Bu kategori
  // filterCategories'te (yalniz urunu olanlar) bulunamayacagi icin ayrica
  // okunur; banner basligi/breadcrumb ile ekran metni bunu kullanir.
  const showComingSoon = entries.length === 0 && !hasActiveFilters && !ara;
  const emptyCategory =
    showComingSoon && kategori
      ? await prisma.category.findUnique({
          where: { slug: kategori, isActive: true },
          select: { name: true, slug: true, imageUrl: true }
        })
      : null;
  // "Bu arada goz atmak ister misin?" kartlari: yayinda urunu olan kategoriler,
  // gorsel olarak o kategoriden en yeni urunun ilk fotografi (yoksa kategori gorseli).
  const emptySuggestions = showComingSoon
    ? await withSampleProductImages(
        filterCategories.filter((c) => c.slug !== kategori).slice(0, 5),
        cinsiyet
      )
    : [];

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
  const bannerTitle = ara ? `“${ara}” için sonuçlar` : (activeCategory?.name ?? heading);
  // "ANA SAYFA / [CINSIYET /] KATEGORI" - son parca sayfanin kendisi, link degil.
  const breadcrumb: { label: string; href?: string }[] = [{ label: "Ana Sayfa", href: "/" }];
  if (ara) {
    breadcrumb.push({ label: "Arama" });
  } else if (activeCategory) {
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
            <div>
              <h1 className="py-[9.4px] font-display text-[27px] font-normal leading-[27px] tracking-[-1.08px] md:text-[47px] md:leading-[47px] md:tracking-[-1.88px]">
                {bannerTitle}
              </h1>
              {ara && <p className="mt-2 text-xs tracking-[0.48px] text-cream/80">{entries.length} ürün</p>}
            </div>
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
        ara && !hasActiveFilters ? (
          <div className="mt-16 flex flex-col items-center text-center">
            <p className="text-2xl font-normal tracking-[-0.5px]">“{ara}” için sonuç bulunamadı</p>
            <p className="mt-3 text-sm text-ink/60">Farklı bir kelime deneyin.</p>
            <Link
              href="/urunler"
              className="mt-8 flex h-[44px] items-center justify-center rounded-[50px] border border-ink px-8 text-[10px] uppercase tracking-[1px] text-ink transition duration-300 hover:bg-ink hover:text-cream"
            >
              Tüm Ürünlere Göz At
            </Link>
          </div>
        ) : hasActiveFilters ? (
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
            gender={cinsiyet ?? null}
            suggestions={emptySuggestions}
          />
        )
      ) : (
        // key: filtre/siralama/arama degisince grid durumu (eklenmis
        // partiler) sifirlanir, liste 24'ten baslar.
        <CatalogGrid
          key={gridQuery}
          initialItems={entries.slice(0, show).map((entry) => toCatalogCardProps(entry, automaticCampaigns))}
          total={entries.length}
          query={gridQuery}
        />
      )}
      </div>
    </div>
  );
}
