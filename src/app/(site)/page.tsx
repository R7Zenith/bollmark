import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { getPublishedProducts, productToCatalogEntries } from "@/lib/catalog";
import { FeaturedCarousel } from "@/components/featured-carousel";
import { BestsellersTabs, type BestsellerTab } from "@/components/home/bestsellers-tabs";
import { BudgetTiles } from "@/components/home/budget-tiles";
import { CampaignBand, SeasonColors } from "@/components/home/campaign-or-colors";
import { FaqAndStore } from "@/components/home/faq-and-store";
import { InstagramGrid } from "@/components/home/instagram-grid";
import { ShopByCategory, type CollectionBox } from "@/components/home/shop-by-category";
import { TrustMarquee } from "@/components/home/trust-marquee";
import { prisma } from "@/lib/prisma";
import { catalogHref, GENDER_GROUPS, genderWhere } from "@/lib/catalog-url";
import { getActiveAutomaticPercentCampaigns, resolveProductDisplayPrice } from "@/lib/coupons";
import { istanbulDateKey, istanbulDayEnd } from "@/lib/format";
import {
  BESTSELLER_TAB_LIMIT,
  bestsellerSince,
  catalogEntryToCardData,
  countBudgetTiers,
  newestProductImage,
  pickBestsellers,
  pickCategoryStrip,
  pickNewArrivals,
  pickSeasonColors
} from "@/lib/home-products";
import { REVENUE_STATUSES } from "@/lib/orders";
import { JsonLd } from "@/components/json-ld";
import { homeJsonLd } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Bollmark | Modern Giyim",
  description:
    "Bollmark - özenle seçilmiş kumaşlar, minimal kesimler. Sezonun öne çıkan giyim parçalarını keşfedin.",
  alternates: { canonical: "/" }
};

// Yedek guvence: urun yazan yerler revalidateCatalog() ile sayfayi aninda
// tazeler; bu, o cagriyi kacirabilecek yollar (elle DB degisikligi vb.) icin
// en gec 1 saatte tazelenmesini saglar.
export const revalidate = 3600;

// Kategori kartlarinda "slug'in kendisi VEYA o slug'in alt kategorisi" sayimi -
// katalog filtresiyle (lib/catalog.ts getPublishedProducts) ayni kural, boylece
// karttaki sayi tiklaninca acilan listeyle tutarli olur.
function publishedInCategory(slug: string) {
  return prisma.product.count({
    where: { status: "PUBLISHED", category: { isActive: true, OR: [{ slug }, { parent: { slug } }] } }
  });
}

// Urun sayisi 0 olsa da ana sayfada gosterilen kategori kartlari (etiketle).
const ALWAYS_SHOWN_COLLECTIONS = new Set(["Ayakkabı"]);

export default async function HomePage() {
  const soldSince = bestsellerSince();
  // Tum sorgular tek Promise.all icinde (ardisik await yok). Cok satanlar icin
  // ayri urun sorgusu YOK: getPublishedProducts zaten tum yayindaki urunleri
  // (gorsel/varyant/stok dahil) getiriyor, satis adetleri tek groupBy ile.
  const [
    products,
    automaticCampaigns,
    kadinCount,
    erkekCount,
    cocukCount,
    ayakkabiCount,
    aksesuarCount,
    categories,
    soldGroups,
    storeSettings
  ] = await Promise.all([
    getPublishedProducts(),
    getActiveAutomaticPercentCampaigns(prisma),
    prisma.product.count({ where: { status: "PUBLISHED", gender: "Kadın" } }),
    prisma.product.count({ where: { status: "PUBLISHED", gender: "Erkek" } }),
    prisma.product.count({ where: { status: "PUBLISHED", gender: genderWhere("Çocuk") } }),
    publishedInCategory("ayakkabi"),
    publishedInCategory("aksesuar"),
    // Kategori seridi + Ayakkabi/Aksesuar kutularinin gorseli ve kapsami.
    prisma.category.findMany({
      where: { isActive: true },
      select: { id: true, name: true, slug: true, sortOrder: true, imageUrl: true, parent: { select: { slug: true } } }
    }),
    prisma.orderItem.groupBy({
      by: ["productId"],
      where: { order: { status: { in: REVENUE_STATUSES }, deletedAt: null, createdAt: { gte: soldSince } } },
      _sum: { quantity: true }
    }),
    prisma.storeSettings.findUnique({ where: { id: "singleton" } })
  ]);

  // Coklu rengi olan bir urun burada rengi kadar ayri kart olarak gorunur
  // (katalog sayfasindaki gibi) - bkz. lib/catalog.ts productToCatalogEntries.
  // "Yeni Gelenler" listenin BAŞINDAN itibaren 8 KARTI gosterir: once guncel
  // sezon, sonra katalog sirasi (bkz. home-products.ts pickNewArrivals).
  const featuredEntries = pickNewArrivals(products).flatMap(productToCatalogEntries).slice(0, 8);

  // B) "Ne arıyorsun?": yuvarlak kategori seridi + cinsiyet/grup kutulari.
  // Kutularda sayisi 0 olan gizlenir (Ayakkabi haric: magaza PUMA/Slazenger
  // satiyor, sahibinin istegiyle kategori bos olsa da gorunur; bkz.
  // ALWAYS_SHOWN_COLLECTIONS). Stok fotograf yok: Ayakkabi/Aksesuar'da
  // kategorinin imageUrl'i (admin), yoksa gruptaki en yeni (once one cikan)
  // urunun fotografi; o da yoksa kart yazili kalir.
  const categoryStrip = pickCategoryStrip(categories, products).map((c) => ({
    ...c,
    href: catalogHref({ category: c.slug })
  }));
  const inCategoryTree = (slug: string) => {
    const ids = new Set(categories.filter((c) => c.slug === slug || c.parent?.slug === slug).map((c) => c.id));
    return products.filter((p) => p.categoryId != null && ids.has(p.categoryId));
  };
  const categoryBoxImage = (slug: string) => {
    const imageUrl = categories.find((c) => c.slug === slug)?.imageUrl;
    return imageUrl ? { url: imageUrl, greyBackdrop: false } : newestProductImage(inCategoryTree(slug), true);
  };
  const inGender = (label: string) =>
    products.filter((p) => p.gender != null && (GENDER_GROUPS[label] ?? [label]).includes(p.gender));
  const collections: CollectionBox[] = [
    { label: "Kadın", count: kadinCount, href: "/kadin", image: newestProductImage(inGender("Kadın"), true) },
    { label: "Erkek", count: erkekCount, href: "/erkek", image: newestProductImage(inGender("Erkek"), true) },
    { label: "Çocuk", count: cocukCount, href: "/cocuk", image: newestProductImage(inGender("Çocuk"), true) },
    { label: "Ayakkabı", count: ayakkabiCount, href: "/kategori/ayakkabi", image: categoryBoxImage("ayakkabi") },
    { label: "Aksesuar", count: aksesuarCount, href: "/kategori/aksesuar", image: categoryBoxImage("aksesuar") }
  ].filter((c) => c.count > 0 || ALWAYS_SHOWN_COLLECTIONS.has(c.label));

  // C) Aktif otomatik kampanya etiketi: sayfadaki kartlarin gosterdigi gercek
  // kampanya indiriminin en yuksegi (resolveProductDisplayPrice, kartlarla ayni
  // kaynak) - yalniz gercekten bir urune uygulanan kampanya sayilir, oran
  // uydurulmaz. Kampanya yoksa 0 doner ve etiket gosterilmez.
  const campaignPercent = Math.max(
    0,
    ...products.map((p) => {
      const r = resolveProductDisplayPrice(automaticCampaigns, p);
      return r.source === "KAMPANYA" ? (r.badgePercent ?? 0) : 0;
    })
  );
  // Geri sayim: bu orandaki kampanyalarin hepsinin bitis tarihi varsa en
  // gec bitenin son gunu, Istanbul 23:59:59 (getActiveAutomaticPercentCampaigns
  // kampanyayi expiresAt gununun sonuna kadar gecerli sayiyor).
  const topCampaignEnds = automaticCampaigns.filter((c) => c.value === campaignPercent).map((c) => c.expiresAt);
  const lastEndKey =
    campaignPercent > 0 && topCampaignEnds.every((d): d is Date => d !== null)
      ? topCampaignEnds.map((d) => istanbulDateKey(d)).sort().at(-1)
      : undefined;
  const campaignEndsAt = lastEndKey ? istanbulDayEnd(lastEndKey).toISOString() : null;

  // E) "Bütçene göre" sayimlari ve F) kampanya yoksa "Sezonun renkleri" -
  // ikisi de katalogdaki renk-basina-kart kuraliyla (bkz. home-products.ts).
  const budget = countBudgetTiers(products.flatMap(productToCatalogEntries), automaticCampaigns);
  const seasonColors = campaignPercent > 0 ? [] : pickSeasonColors(products);

  // D) Cok satanlar: sekme basina ayri liste (Tumu/Kadin/Erkek/Cocuk), urunu
  // olmayan sekme gizlenir. Kart verisi Yeni Gelenler ile ayni yardimciyla.
  const soldByProductId = new Map(soldGroups.map((g) => [g.productId, g._sum.quantity ?? 0]));
  const bestsellerTabs: BestsellerTab[] = [
    { key: "tumu", label: "Tümü", gender: null },
    { key: "kadin", label: "Kadın", gender: "Kadın" },
    { key: "erkek", label: "Erkek", gender: "Erkek" },
    { key: "cocuk", label: "Çocuk", gender: "Çocuk" }
  ]
    .map(({ key, label, gender }) => ({
      key,
      label,
      // Urun secimi (satis adedi/one cikan/en yeni) hep urun bazinda kalir
      // (pickBestsellers degismedi) - sadece secilen urunler renk basina
      // ayri karta bolunuyor, toplam kart sayisi yine ayni limitte kesiliyor.
      products: pickBestsellers(
        gender ? products.filter((p) => p.gender != null && (GENDER_GROUPS[gender] ?? [gender]).includes(p.gender)) : products,
        soldByProductId
      )
        .flatMap(productToCatalogEntries)
        .slice(0, BESTSELLER_TAB_LIMIT)
        .map((entry) => catalogEntryToCardData(entry, automaticCampaigns))
    }))
    .filter((t) => t.products.length > 0);

  return (
    <div>
      <JsonLd data={homeJsonLd()} />
      {/* 1) Tam ekran hero: buyuk moda fotografi + etiket + cok buyuk baslik +
          hap-buton (Shopify "Release" temasi referansi). Mobilde metin
          bloğu eskiden dikey ortalanıyordu ve text-6xl başlık ekranın
          büyük bölümünü kaplayıp fotoğrafı örtüyordu - kullanıcı geri
          bildirimiyle mobilde sol-alta indirildi (items-end) ve daha zarif
          durması için kücültüldü (text-3xl); mobil bu haliyle kasıtlı
          olarak dokunulmadan bırakıldı. Masaüstünde (md:) Release'in canlı
          demosuyla (release-main.myshopify.com) birebir ölçülen hizalamaya
          getirildi: metin bloğu tam genişlikte ortalı ve alta yaslı,
          "Keşfet" butonu şeffaf/ince çerçeveli (outline) hap-buton, başlık
          font boyutu Release'de olculen 1024px/1600px degerleriyle
          orantili bir clamp()'e alindi. Uc metin ogesi de (.hero-reveal,
          bkz. globals.css) Release'in giris animasyonunu birebir kullanir:
          sayfa yuklenince asagidan kayarak/solarak belirir. NOT: bu
          overflow:hidden sarmalayici yuzunden satir yuksekligi Release'in
          olcumu (1:1, leading-[0.95]e yakin) kadar sıkı tutulamiyor -
          Turkce "ç" harfinin altindaki cengel kirpiliyor ve iki satir
          basligda ust/alt satir birbirine deger hale geliyordu; bu yuzden
          md:leading-[1.15] ile bilincli gevsetildi. Bu satir araligi ust/alt
          satir cakismasini cozdu ama son satirin cengeli hala sarmalayicinin
          ALT kenarindan tasip kirpiliyordu - h1'in kendi kutusu satir
          yuksekligiyle bitiyor, cengel onun disina cikiyordu; pb-[0.15em]
          (font-size'a orantili) ile h1'in kutusu asagi dogru genisletilip
          cengele yer acildi. */}
      <section className="relative flex min-h-screen items-end overflow-hidden bg-ink text-cream md:items-end">
        <Image
          src="/hero-model.jpg"
          alt="Bollmark kampanya görseli"
          fill
          priority
          sizes="100vw"
          className="object-cover"
          style={{ objectPosition: "50% 18%" }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-ink/70 via-ink/20 to-transparent" />
        <div className="relative z-10 mx-auto w-full max-w-7xl px-6 pb-14 md:max-w-none md:px-[54px] md:pb-16 md:pt-[97px] md:text-center">
          <div className="hero-reveal">
            <p className="text-[10px] uppercase tracking-widest2 text-cream/70 md:text-xs">2026 Sonbahar / Kış</p>
          </div>
          <div className="hero-reveal">
            <h1 className="mt-2 max-w-[13rem] pb-[0.15em] font-display text-3xl font-light leading-[1.05] md:mx-auto md:mt-6 md:max-w-3xl md:text-[clamp(3.8125rem,1.7013rem+3.2986vw,5rem)] md:leading-[1.15]">
              Her gün için, her parça için
            </h1>
          </div>
          <div className="hero-reveal">
            <Link
              href="/urunler"
              className="mt-5 inline-flex items-center rounded-full bg-cream px-6 py-2.5 text-xs uppercase tracking-wide text-ink transition hover:bg-clay hover:text-cream md:mt-10 md:border md:border-cream md:bg-transparent md:px-8 md:py-3.5 md:text-sm md:text-cream md:hover:bg-cream md:hover:text-ink"
            >
              Keşfet
            </Link>
          </div>
        </div>
      </section>

      {/* 2) Yeni Gelenler / Öne Çıkanlar - Release temasindaki "just arrived"
          slider'i: masaustunde 4'lu, tek urun adimlarla kayan carousel
          (bkz. featured-carousel.tsx), mobilde sabit 2 sutunlu grid. Katalog
          sayfasiyla (bkz. urunler/page.tsx) BIREBIR ayni olcude olmasi icin
          max-w-7xl yerine ayni tam-genislik gutter'i (px-4 md:px-6 xl:px-9)
          kullaniyor - aksi halde genis ekranlarda kartlar katalogdakinden
          kucuk gorunuyordu. Ust bosluk hero'nun hemen altinda fazla bosluk
          birakmasin diye pt-section yerine dar tutuldu, alt bosluk bir
          sonraki bolumle ayni ritmi korumasi icin pb-section'da birakildi. */}
      <section className="px-4 pb-section pt-10 md:px-6 md:pt-14 xl:px-9">
        {products.length === 0 ? (
          <>
            <div className="mb-12 flex items-end justify-between">
              <h2 className="font-display text-3xl font-light">Yeni Gelenler</h2>
              <Link href="/urunler" className="text-sm uppercase tracking-wide hover:text-clay">
                Tümünü Gör →
              </Link>
            </div>
            <p className="text-ink/60">
              Henüz yayınlanmış ürün yok. Admin panelinden ilk ürününüzü ekleyin.
            </p>
          </>
        ) : (
          <FeaturedCarousel products={featuredEntries.map((entry) => catalogEntryToCardData(entry, automaticCampaigns))} />
        )}
      </section>

      {/* Yeni Gelenler'in altindaki bolumler (bkz.
          docs/planlar/ANASAYFA_ALT_BOLUM_YENILEME_PLANI.md): her gorsel ya
          gercek urun ya da magaza fotografi; veri yoksa bolum gizlenir. Her
          bolum kendi pb-section'iyla biter. */}
      <TrustMarquee
        campaignPercent={campaignPercent}
        defaultShippingCents={storeSettings?.defaultShippingCents ?? 0}
      />

      <ShopByCategory strip={categoryStrip} boxes={collections} />

      {/* Cok satanlar (sekmeli, sira numarali; bkz.
          components/home/bestsellers-tabs.tsx). Hic urun yoksa render edilmez. */}
      {bestsellerTabs.length > 0 && (
        <section className="px-4 pb-section md:px-6 xl:px-9">
          <BestsellersTabs tabs={bestsellerTabs} />
        </section>
      )}

      {/* Faz 2: "Kombini Tamamla" bu araya gelecek. */}

      <BudgetTiles tiers={budget.tiers} onSaleCount={budget.onSaleCount} />

      {campaignPercent > 0 ? (
        <CampaignBand percent={campaignPercent} endsAt={campaignEndsAt} />
      ) : (
        <SeasonColors colors={seasonColors} />
      )}

      {/* Instagram galerisi - env + fotograflar yoksa kendini gizler. */}
      <InstagramGrid />

      {/* SSS (sol) + Karacabey magazasi (sag), canlidaki gibi yan yana. */}
      <FaqAndStore
        contactPhone={storeSettings?.contactPhone ?? ""}
        contactEmail={storeSettings?.contactEmail ?? ""}
        defaultShippingCents={storeSettings?.defaultShippingCents ?? 0}
      />
    </div>
  );
}
