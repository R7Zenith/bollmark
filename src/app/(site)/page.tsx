import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { getPublishedProducts, firstImageUrl, isOutOfStock } from "@/lib/catalog";
import { ProductCard } from "@/components/product-card";
import { prisma } from "@/lib/prisma";
import { getActiveAutomaticPercentCampaigns, matchAutomaticDiscount } from "@/lib/coupons";

export const metadata: Metadata = {
  title: "Bollmark | Modern Giyim",
  description:
    "Bollmark - özenle seçilmiş kumaşlar, minimal kesimler. Sezonun öne çıkan giyim parçalarını keşfedin.",
  alternates: { canonical: "https://bollmark.com" }
};

export default async function HomePage() {
  const [products, automaticCampaigns] = await Promise.all([
    getPublishedProducts(undefined, { featuredFirst: true }),
    getActiveAutomaticPercentCampaigns(prisma)
  ]);

  const categoryShortcuts = [
    {
      label: "Kadın",
      href: "/urunler?cinsiyet=Kadın",
      image: "https://images.unsplash.com/photo-1495385794356-15371f348c31?w=1200",
      span: "row-span-2"
    },
    {
      label: "Erkek",
      href: "/urunler?cinsiyet=Erkek",
      image: "https://images.unsplash.com/photo-1516257984-b1b4d707412e?w=1200",
      span: ""
    },
    {
      label: "Aksesuar",
      href: "/urunler?kategori=aksesuar",
      image: "https://images.unsplash.com/photo-1509941943102-10c232535736?w=1200",
      span: ""
    }
  ];

  return (
    <div>
      <section className="relative flex min-h-screen items-center overflow-hidden bg-ink text-cream">
        <Image
          src="https://images.unsplash.com/photo-1490114538077-0a7f8cb49891?w=1800"
          alt="Bollmark kampanya görseli"
          fill
          priority
          className="object-cover opacity-60"
        />
        <div className="relative z-10 mx-auto w-full max-w-7xl px-6">
          <p className="text-xs uppercase tracking-widest2 text-cream/70">2026 Sonbahar / Kış</p>
          <h1 className="mt-6 max-w-3xl font-display text-6xl font-light leading-[0.95] md:text-8xl">
            Her gün için, her parça için
          </h1>
          <Link
            href="/urunler"
            className="mt-10 inline-flex items-center gap-2 border-b border-cream pb-1 text-sm uppercase tracking-wide transition hover:gap-3"
          >
            Koleksiyonu Keşfet <span aria-hidden>→</span>
          </Link>
        </div>
      </section>

      {/* Aritzia'daki gibi kenardan kenara, aralarinda bosluk olmayan kategori
          duvari - max-w container ve gap kasitli olarak yok, tam tarayici
          genisliginde "goruntu duvari" hissi icin. */}
      <section className="grid grid-cols-2 grid-rows-2 md:h-[760px]">
        {categoryShortcuts.map((c) => (
          <Link
            key={c.label}
            href={c.href}
            className={`group relative block overflow-hidden bg-line ${c.span} ${c.span ? "" : "aspect-[3/4] md:aspect-auto"}`}
          >
            <Image
              src={c.image}
              alt={`${c.label} koleksiyonu`}
              fill
              sizes="(min-width: 768px) 50vw, 100vw"
              className="object-cover transition duration-500 ease-out group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-ink/50 via-transparent to-transparent" />
            <span className="absolute bottom-6 left-6 font-display text-3xl font-light text-cream">
              {c.label}
            </span>
          </Link>
        ))}
      </section>

      {/* Kenardan kenara editoryal ara blok - grid'i bolen buyuk bir "kampanya"
          hissi, Aritzia'nin ana sayfa ortasindaki tam genislik gorsel+metin
          bloklarina karsilik gelir. */}
      <section id="hikaye" className="grid md:grid-cols-2">
        <div className="relative aspect-[4/5] md:aspect-auto">
          <Image
            src="https://images.unsplash.com/photo-1441984904996-e0b6ba687e04?w=1400"
            alt="Bollmark atölye"
            fill
            className="object-cover"
          />
        </div>
        <div className="flex flex-col justify-center bg-ink px-10 py-16 text-cream md:px-16">
          <p className="text-xs uppercase tracking-widest2 text-cream/60">Hikayemiz</p>
          <h2 className="mt-4 max-w-md font-display text-4xl font-light leading-tight">
            Detaylara verdiğimiz önem
          </h2>
          <p className="mt-6 max-w-md text-cream/70">
            Bollmark, kaliteli kumaşları sade ve zamansız tasarımlarla buluşturur. Her parça, uzun
            yıllar dolabınızda yer alacak şekilde tasarlanır.
          </p>
          <Link
            href="/urunler"
            className="mt-8 inline-flex w-fit items-center gap-2 border-b border-cream pb-1 text-sm uppercase tracking-wide transition hover:gap-3"
          >
            Koleksiyona Git <span aria-hidden>→</span>
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-section">
        <div className="mb-12 flex items-end justify-between">
          <h2 className="font-display text-3xl font-light">Öne Çıkanlar</h2>
          <Link href="/urunler" className="text-sm uppercase tracking-wide hover:text-clay">
            Tümünü Gör →
          </Link>
        </div>
        {products.length === 0 ? (
          <p className="text-ink/60">
            Henüz yayınlanmış ürün yok. Admin panelinden ilk ürününüzü ekleyin.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-x-3 gap-y-10 md:grid-cols-4">
            {products.map((p) => (
              <ProductCard
                key={p.id}
                product={{
                  productId: p.id,
                  slug: p.slug,
                  name: p.name,
                  priceCents: p.priceCents,
                  compareAtCents: p.compareAtCents,
                  image: firstImageUrl(p) ?? "https://images.unsplash.com/photo-1445205170230-053b83016050?w=800",
                  automaticDiscountPercent: matchAutomaticDiscount(automaticCampaigns, p)?.percent ?? null,
                  outOfStock: isOutOfStock(p.variants)
                }}
              />
            ))}
          </div>
        )}
      </section>

      {/* Aritzia'nin sayfa ortasindaki dev "Everyday Luxury" tek satirlik
          marka ifadesine karsilik gelen nefes alma alani. */}
      <section className="border-t border-line py-section text-center">
        <p className="font-display text-4xl font-light md:text-5xl">Zamansız Rahatlık</p>
      </section>
    </div>
  );
}
