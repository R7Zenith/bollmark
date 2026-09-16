import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { getPublishedProducts, firstImageUrl, isOutOfStock } from "@/lib/catalog";
import { FeaturedCarousel } from "@/components/featured-carousel";
import { prisma } from "@/lib/prisma";
import { getActiveAutomaticPercentCampaigns, matchAutomaticDiscount } from "@/lib/coupons";

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
          hap-buton (Shopify "Release" temasi referansi). */}
      <section className="relative flex min-h-screen items-center overflow-hidden bg-ink text-cream">
        <Image
          src="/hero-model.jpg"
          alt="Bollmark kampanya görseli"
          fill
          priority
          className="object-cover"
          style={{ objectPosition: "50% 18%" }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-ink/70 via-ink/20 to-transparent" />
        <div className="relative z-10 mx-auto w-full max-w-7xl px-6">
          <p className="text-xs uppercase tracking-widest2 text-cream/70">2026 Sonbahar / Kış</p>
          <h1 className="mt-6 max-w-3xl font-display text-6xl font-light leading-[0.95] md:text-8xl">
            Her gün için, her parça için
          </h1>
          <Link
            href="/urunler"
            className="mt-10 inline-flex items-center rounded-full bg-cream px-8 py-3.5 text-sm uppercase tracking-wide text-ink transition hover:bg-clay hover:text-cream"
          >
            Keşfet
          </Link>
        </div>
      </section>

      {/* 2) Yeni Gelenler / Öne Çıkanlar - Release temasindaki "just arrived"
          slider'i: masaustunde 4'lu, tek urun adimlarla kayan carousel
          (bkz. featured-carousel.tsx), mobilde sabit 2 sutunlu grid. */}
      <section className="mx-auto max-w-7xl px-6 py-section">
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
              automaticDiscountPercent: matchAutomaticDiscount(automaticCampaigns, p)?.percent ?? null,
              outOfStock: isOutOfStock(p.variants),
              quickAddVariant: p.quickAddVariant
            }))}
          />
        )}
      </section>

      {/* 3) Editoryal iki gorselli blok: solda model fotografi + uzerine
          bindirilmis baslik (bir kelimesi Cormorant italik), sagda sade bir
          moda fotografi. */}
      <section id="hikaye" className="grid md:grid-cols-2">
        <div className="relative aspect-[4/5] md:aspect-[3/4]">
          <Image
            src="https://images.unsplash.com/photo-1441984904996-e0b6ba687e04?w=1400"
            alt="Bollmark atölye"
            fill
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-ink/60 via-ink/10 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-10 text-cream md:p-16">
            <p className="text-xs uppercase tracking-widest2 text-cream/70">Hikayemiz</p>
            <h2 className="mt-4 max-w-md font-display text-4xl font-light leading-tight">
              Detaylara verdiğimiz <em className="font-accent italic font-normal">önem</em>
            </h2>
          </div>
        </div>
        <div className="relative aspect-[4/5] md:aspect-[3/4]">
          <Image
            src="https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=1400"
            alt="Bollmark koleksiyonu"
            fill
            className="object-cover"
          />
        </div>
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
