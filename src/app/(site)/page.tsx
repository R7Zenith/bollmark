import Link from "next/link";
import Image from "next/image";
import { getPublishedProducts } from "@/lib/catalog";
import { ProductCard } from "@/components/product-card";

export default async function HomePage() {
  const products = await getPublishedProducts(undefined, { featuredFirst: true });

  return (
    <div>
      <section className="relative flex h-[85vh] min-h-[520px] items-end overflow-hidden bg-ink text-paper">
        <Image
          src="https://images.unsplash.com/photo-1490114538077-0a7f8cb49891?w=1800"
          alt="Bollmark kampanya görseli"
          fill
          priority
          className="object-cover opacity-70"
        />
        <div className="relative z-10 mx-auto w-full max-w-6xl px-6 pb-16">
          <p className="text-sm uppercase tracking-widest2">2026 Sonbahar / Kış Koleksiyonu</p>
          <h1 className="mt-4 max-w-xl font-display text-5xl leading-tight md:text-6xl">
            Zamansız kesimler, özenle seçilmiş kumaşlar
          </h1>
          <Link
            href="/urunler"
            className="mt-8 inline-block border border-paper px-8 py-3 text-sm uppercase tracking-wide transition hover:bg-paper hover:text-ink"
          >
            Koleksiyonu Keşfet
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="mb-10 flex items-end justify-between">
          <h2 className="font-display text-3xl">Öne Çıkanlar</h2>
          <Link href="/urunler" className="text-sm uppercase tracking-wide hover:text-accent">
            Tümünü Gör →
          </Link>
        </div>
        {products.length === 0 ? (
          <p className="text-ink/60">
            Henüz yayınlanmış ürün yok. Admin panelinden ilk ürününüzü ekleyin.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-x-6 gap-y-12 md:grid-cols-4">
            {products.map((p) => (
              <ProductCard
                key={p.id}
                product={{
                  productId: p.id,
                  slug: p.slug,
                  name: p.name,
                  priceCents: p.priceCents,
                  compareAtCents: p.compareAtCents,
                  image: p.images[0]?.url ?? "https://images.unsplash.com/photo-1445205170230-053b83016050?w=800"
                }}
              />
            ))}
          </div>
        )}
      </section>

      <section id="hikaye" className="border-t border-line bg-white py-20">
        <div className="mx-auto grid max-w-6xl gap-12 px-6 md:grid-cols-2">
          <div className="relative aspect-[4/3] overflow-hidden">
            <Image
              src="https://images.unsplash.com/photo-1441984904996-e0b6ba687e04?w=1200"
              alt="Bollmark atölye"
              fill
              className="object-cover"
            />
          </div>
          <div className="flex flex-col justify-center">
            <p className="text-sm uppercase tracking-widest2 text-accent">Hikayemiz</p>
            <h2 className="mt-4 font-display text-3xl">Detaylara verdiğimiz önem</h2>
            <p className="mt-4 text-ink/70">
              Bollmark, kaliteli kumaşları sade ve zamansız tasarımlarla buluşturur. Her parça,
              uzun yıllar dolabınızda yer alacak şekilde tasarlanır.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
