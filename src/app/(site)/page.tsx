import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { getPublishedProducts, firstImageUrl, isOutOfStock } from "@/lib/catalog";
import { FeaturedCarousel } from "@/components/featured-carousel";
import { prisma } from "@/lib/prisma";
import { getActiveAutomaticPercentCampaigns, resolveProductDisplayPrice } from "@/lib/coupons";

export const metadata: Metadata = {
  title: "Bollmark | Modern Giyim",
  description:
    "Bollmark - özenle seçilmiş kumaşlar, minimal kesimler. Sezonun öne çıkan giyim parçalarını keşfedin.",
  alternates: { canonical: "https://bollmark.com" }
};

export default async function HomePage() {
  const [products, automaticCampaigns, kadinCount, erkekCount, aksesuarCount] = await Promise.all([
    getPublishedProducts(undefined, { featuredFirst: true }),
    getActiveAutomaticPercentCampaigns(prisma),
    prisma.product.count({ where: { status: "PUBLISHED", gender: "Kadın" } }),
    prisma.product.count({ where: { status: "PUBLISHED", gender: "Erkek" } }),
    prisma.product.count({
      where: {
        status: "PUBLISHED",
        category: { isActive: true, OR: [{ slug: "aksesuar" }, { parent: { slug: "aksesuar" } }] }
      }
    })
  ]);

  const featuredProducts = products.slice(0, 8);

  const collections = [
    {
      label: "Kadın",
      count: kadinCount,
      href: "/urunler?cinsiyet=Kadın",
      image: "https://images.unsplash.com/photo-1495385794356-15371f348c31?w=1200"
    },
    {
      label: "Erkek",
      count: erkekCount,
      href: "/urunler?cinsiyet=Erkek",
      image: "https://images.unsplash.com/photo-1516257984-b1b4d707412e?w=1200"
    },
    {
      label: "Aksesuar",
      count: aksesuarCount,
      href: "/urunler?kategori=aksesuar",
      image: "https://images.unsplash.com/photo-1509941943102-10c232535736?w=1200"
    }
  ];

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
          md:leading-[1.15] ile bilincli gevsetildi. */}
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
            <h1 className="mt-2 max-w-[13rem] font-display text-3xl font-light leading-[1.05] md:mx-auto md:mt-6 md:max-w-3xl md:text-[clamp(3.8125rem,1.7013rem+3.2986vw,5rem)] md:leading-[1.15]">
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
              <h2 className="font-display text-3xl font-light">Öne Çıkanlar</h2>
              <Link href="/urunler" className="text-sm uppercase tracking-wide hover:text-clay">
                Tümünü Gör →
              </Link>
            </div>
            <p className="text-ink/60">
              Henüz yayınlanmış ürün yok. Admin panelinden ilk ürününüzü ekleyin.
            </p>
          </>
        ) : (
          <FeaturedCarousel
            products={featuredProducts.map((p) => ({
              productId: p.id,
              slug: p.slug,
              name: p.name,
              priceCents: p.priceCents,
              compareAtCents: p.compareAtCents,
              image: firstImageUrl(p) ?? "https://images.unsplash.com/photo-1445205170230-053b83016050?w=800",
              priceResolution: resolveProductDisplayPrice(automaticCampaigns, p),
              outOfStock: isOutOfStock(p.variants),
              quickAddVariants: p.quickAddVariants
            }))}
          />
        )}
      </section>

      {/* 4) Tam genislik tek buyuk gorsel, uzerine bindirilmis cok buyuk
          baslik (bir kelimesi italik) + ortada bir hap buton. */}
      <section className="relative flex min-h-[70vh] items-center justify-center overflow-hidden bg-ink text-center text-cream">
        <Image
          src="https://images.unsplash.com/photo-1445205170230-053b83016050?w=1800"
          alt="Bollmark zamansız koleksiyon"
          fill
          className="object-cover opacity-50"
        />
        <div className="relative z-10 mx-auto max-w-3xl px-6">
          <p className="font-display text-4xl font-light leading-tight md:text-6xl">
            Zamansız <em className="font-accent italic font-normal">Rahatlık</em>
          </p>
          <Link
            href="/urunler"
            className="mt-8 inline-flex items-center rounded-full border border-cream px-8 py-3.5 text-sm uppercase tracking-wide transition hover:bg-cream hover:text-ink"
          >
            Koleksiyonu Keşfet
          </Link>
        </div>
      </section>

      {/* 5) Ozel Koleksiyonlarimiz - 3 kategori karti (gorsel + ad + urun
          sayisi ust simge). */}
      <section className="mx-auto max-w-7xl px-6 py-section">
        <h2 className="mb-12 text-center font-display text-3xl font-light">Özel Koleksiyonlarımız</h2>
        <div className="grid gap-6 md:grid-cols-3">
          {collections.map((c) => (
            <Link key={c.label} href={c.href} className="group relative block aspect-[3/4] overflow-hidden bg-line">
              <Image
                src={c.image}
                alt={`${c.label} koleksiyonu`}
                fill
                sizes="(min-width: 768px) 33vw, 100vw"
                className="object-cover transition duration-500 ease-out group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-ink/50 via-transparent to-transparent" />
              <div className="absolute bottom-6 left-6 text-cream">
                <span className="font-display text-2xl font-light">
                  {c.label} <sup className="text-sm text-cream/70">{c.count}</sup>
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
