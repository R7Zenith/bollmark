import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { getPublishedProducts } from "@/lib/catalog";
import { FeaturedCarousel } from "@/components/featured-carousel";
import { BestsellersTabs, type BestsellerTab } from "@/components/home/bestsellers-tabs";
import { FaqAndStore } from "@/components/home/faq-and-store";
import { InstagramGrid } from "@/components/home/instagram-grid";
import { prisma } from "@/lib/prisma";
import { getActiveAutomaticPercentCampaigns, resolveProductDisplayPrice } from "@/lib/coupons";
import { bestsellerSince, percentWithDative, pickBestsellers, toProductCardData } from "@/lib/home-products";
import { REVENUE_STATUSES } from "@/lib/orders";

export const metadata: Metadata = {
  title: "Bollmark | Modern Giyim",
  description:
    "Bollmark - özenle seçilmiş kumaşlar, minimal kesimler. Sezonun öne çıkan giyim parçalarını keşfedin.",
  alternates: { canonical: "https://bollmark.com" }
};

// Yedek guvence: urun yazan yerler revalidateCatalog() ile sayfayi aninda
// tazeler; bu, o cagriyi kacirabilecek yollar (elle DB degisikligi vb.) icin
// en gec 1 dakikada tazelenmesini saglar.
export const revalidate = 60;

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
    categoryImages,
    soldGroups,
    storeSettings
  ] = await Promise.all([
    getPublishedProducts(),
    getActiveAutomaticPercentCampaigns(prisma),
    prisma.product.count({ where: { status: "PUBLISHED", gender: "Kadın" } }),
    prisma.product.count({ where: { status: "PUBLISHED", gender: "Erkek" } }),
    prisma.product.count({ where: { status: "PUBLISHED", gender: "Çocuk" } }),
    publishedInCategory("ayakkabi"),
    publishedInCategory("aksesuar"),
    prisma.category.findMany({
      where: { slug: { in: ["ayakkabi", "aksesuar"] }, isActive: true },
      select: { slug: true, imageUrl: true }
    }),
    prisma.orderItem.groupBy({
      by: ["productId"],
      where: { order: { status: { in: REVENUE_STATUSES }, deletedAt: null, createdAt: { gte: soldSince } } },
      _sum: { quantity: true }
    }),
    prisma.storeSettings.findUnique({ where: { id: "singleton" } })
  ]);

  const featuredProducts = products.slice(0, 8);

  // B) Kategori kartlari. Sayisi 0 olan kart gizlenir (Ayakkabi haric: magaza
  // PUMA/Slazenger satiyor, sahibinin istegiyle kategori bos olsa da gorunur;
  // bkz. ALWAYS_SHOWN_COLLECTIONS). Kategorinin kendi
  // imageUrl'i (admin) doluysa o, yoksa public/anasayfa/ altindaki yerel yedek.
  // Kadin/Erkek/Cocuk kategori degil cinsiyet filtresidir, imageUrl'leri yok.
  const categoryImage = (slug: string) => categoryImages.find((c) => c.slug === slug)?.imageUrl ?? null;
  const collections = [
    { label: "Kadın", count: kadinCount, href: "/urunler?cinsiyet=Kadın", image: "/anasayfa/koleksiyon-kadin.jpg", remote: false },
    { label: "Erkek", count: erkekCount, href: "/urunler?cinsiyet=Erkek", image: "/anasayfa/koleksiyon-erkek.jpg", remote: false },
    { label: "Çocuk", count: cocukCount, href: "/urunler?cinsiyet=Çocuk", image: "/anasayfa/koleksiyon-cocuk.jpg", remote: false },
    {
      label: "Ayakkabı",
      count: ayakkabiCount,
      href: "/urunler?kategori=ayakkabi",
      image: categoryImage("ayakkabi") ?? "/anasayfa/koleksiyon-ayakkabi.jpg",
      remote: categoryImage("ayakkabi") !== null
    },
    {
      label: "Aksesuar",
      count: aksesuarCount,
      href: "/urunler?kategori=aksesuar",
      image: categoryImage("aksesuar") ?? "/anasayfa/koleksiyon-aksesuar.jpg",
      remote: categoryImage("aksesuar") !== null
    }
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
      products: pickBestsellers(
        gender ? products.filter((p) => p.gender === gender) : products,
        soldByProductId
      ).map((p) => toProductCardData(p, automaticCampaigns))
    }))
    .filter((t) => t.products.length > 0);

  return (
    <div>
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
          <FeaturedCarousel products={featuredProducts.map((p) => toProductCardData(p, automaticCampaigns))} />
        )}
      </section>

      {/* A) Editoryal ikili blok (Release'in "Timeless classics" blogu):
          masaustunde 2 sutun, mobilde alt alta. Sol kart metinli ve TAMAMI
          tiklanabilir (ic ice <a> olmasin diye ustte tek seffaf Link, gorunen
          "Keşfet" hap butonu span); sag kart metinsiz, tamami Erkek
          koleksiyonuna baglanir. Hover: kategori kartlariyla ayni scale-105. */}
      <section className="grid gap-4 px-4 pb-section md:grid-cols-2 md:gap-6 md:px-6 xl:px-9">
        <div className="group relative aspect-[4/5] overflow-hidden bg-line">
          <Image
            src="/anasayfa/editoryal-sol.jpg"
            alt="Bollmark kadın sonbahar koleksiyonu"
            fill
            sizes="(min-width: 768px) 50vw, 100vw"
            className="object-cover transition duration-500 ease-out group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-ink/50 via-transparent to-transparent" />
          <Link href="/urunler" aria-label="Zamansız klasikler: Keşfet" className="absolute inset-0 z-10" />
          <div className="pointer-events-none absolute bottom-6 left-6 right-6 text-cream md:bottom-8 md:left-8">
            <p className="font-display text-3xl font-normal leading-tight tracking-[-0.04em] md:text-5xl">
              Zamansız <em className="font-accent italic font-normal">klasikler</em>
            </p>
            <span className="mt-5 inline-flex items-center rounded-full border border-cream px-8 py-3.5 text-sm uppercase tracking-wide transition group-hover:bg-cream group-hover:text-ink">
              Keşfet
            </span>
          </div>
        </div>
        <Link
          href="/urunler?cinsiyet=Erkek"
          aria-label="Erkek koleksiyonu"
          className="group relative block aspect-[4/5] overflow-hidden bg-line"
        >
          <Image
            src="/anasayfa/editoryal-sag.jpg"
            alt="Bollmark erkek palto"
            fill
            sizes="(min-width: 768px) 50vw, 100vw"
            className="object-cover transition duration-500 ease-out group-hover:scale-105"
          />
        </Link>
      </section>

      {/* B) Kategori kartlari. Masaustunde kartlar satiri esit paylasir
          (lg:grid-flow-col + auto-cols-fr: 5 kartta 5 sutun, sayisi 0 olan kart
          gizlendigi icin 3 kartta 3 sutun - sagda bos alan kalmaz), tablette 3
          sutun, mobilde yatay kaydirmali (snap-x, kart ~44vw) - dikey yigilma
          yok. Kenardan kenara kaydirma icin -mx-4 + px-4. */}
      {collections.length > 0 && (
        <section className="px-4 pb-section md:px-6 xl:px-9">
          <h2 className="mb-10 font-display text-3xl font-normal tracking-[-0.04em] md:mb-12 md:text-5xl">
            Özel Koleksiyonlarımız
          </h2>
          <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 [scrollbar-width:none] md:mx-0 md:grid md:grid-cols-3 md:gap-4 md:overflow-visible md:px-0 lg:grid-flow-col lg:auto-cols-fr lg:grid-cols-none [&::-webkit-scrollbar]:hidden">
            {collections.map((c) => (
              <Link
                key={c.label}
                href={c.href}
                className="group relative block aspect-[3/4] w-[44vw] shrink-0 snap-start overflow-hidden bg-line md:w-auto"
              >
                {c.remote ? (
                  // Admin'den gelen kategori imageUrl'i next/image'in remotePatterns
                  // listesi disinda bir kaynaktan da olabilir - duz <img> (bkz.
                  // urunler/page.tsx banner'i ile ayni gerekce).
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={c.image}
                    alt={`${c.label} koleksiyonu`}
                    loading="lazy"
                    className="absolute inset-0 h-full w-full object-cover transition duration-500 ease-out group-hover:scale-105"
                  />
                ) : (
                  <Image
                    src={c.image}
                    alt={`${c.label} koleksiyonu`}
                    fill
                    sizes="(min-width: 768px) 33vw, 44vw"
                    className="object-cover transition duration-500 ease-out group-hover:scale-105"
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-ink/50 via-transparent to-transparent" />
                <div className="absolute bottom-4 left-4 text-cream md:bottom-6 md:left-6">
                  <span className="font-display text-xl font-light md:text-2xl">
                    {c.label} {c.count > 0 && <sup className="text-sm text-cream/70">{c.count}</sup>}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* C) Tam genislik lookbook: yerel gorsel + gradient overlay (eski
          opacity-50 yerine; hero'daki from-ink/... gradyaniyla ayni dil) -
          metin okunakli kalirken foto soluklasmaz. Aktif otomatik kampanya
          varsa basligin ustunde hap etiket (oran kartlardaki gercek
          indirimden gelir, bkz. campaignPercent). */}
      <section className="relative flex min-h-[60vh] items-center justify-center overflow-hidden bg-ink text-center text-cream md:min-h-[70vh]">
        <Image
          src="/anasayfa/lookbook-genis.jpg"
          alt="Bollmark sonbahar kış koleksiyonu"
          fill
          sizes="100vw"
          className="object-cover object-[50%_12%]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-ink/70 via-ink/40 to-ink/30" />
        <div className="relative z-10 mx-auto max-w-3xl px-6">
          {campaignPercent > 0 && (
            <p className="mb-6 inline-flex rounded-full border border-cream/60 px-4 py-1.5 text-[10px] font-medium uppercase tracking-[0.1em]">
              Sezon fırsatı: {percentWithDative(campaignPercent)} varan indirim
            </p>
          )}
          <h2 className="font-display text-4xl font-light leading-tight md:text-6xl">
            Her güne <em className="font-accent italic font-normal">uyan</em> parçalar
          </h2>
          <p className="mt-4 text-sm text-cream/80">2026 Sonbahar / Kış</p>
          <Link
            href="/urunler"
            className="mt-8 inline-flex items-center rounded-full border border-cream px-8 py-3.5 text-sm uppercase tracking-wide transition hover:bg-cream hover:text-ink"
          >
            Koleksiyonu Keşfet
          </Link>
        </div>
      </section>

      {/* D) Cok satanlar (sekmeli, bkz. components/home/bestsellers-tabs.tsx).
          Hic urun yoksa (bos DB) bolum render edilmez. */}
      {bestsellerTabs.length > 0 && (
        <section className="px-4 py-section md:px-6 xl:px-9">
          <BestsellersTabs tabs={bestsellerTabs} />
        </section>
      )}

      {/* E) Instagram galerisi - env + fotograflar yoksa kendini gizler. */}
      <InstagramGrid />

      {/* F) SSS + magaza bilgisi. Alt bosluk yok: footer kendi mt-section'ini
          getiriyor. */}
      <FaqAndStore
        contactPhone={storeSettings?.contactPhone ?? ""}
        contactEmail={storeSettings?.contactEmail ?? ""}
        defaultShippingCents={storeSettings?.defaultShippingCents ?? 0}
      />
    </div>
  );
}
