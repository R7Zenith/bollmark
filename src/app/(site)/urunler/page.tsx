import type { Metadata } from "next";
import { getCatalogEntries } from "@/lib/catalog";
import { prisma } from "@/lib/prisma";
import { ProductCard } from "@/components/product-card";

const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1445205170230-053b83016050?w=800";

export async function generateMetadata({
  searchParams
}: {
  searchParams: Promise<{ kategori?: string }>;
}): Promise<Metadata> {
  const { kategori } = await searchParams;
  if (kategori) {
    const category = await prisma.category.findUnique({
      where: { slug: kategori, isActive: true },
      select: { name: true }
    });
    if (category) {
      return {
        title: `${category.name} | Bollmark`,
        description: `Bollmark ${category.name} koleksiyonunu keşfedin.`
      };
    }
  }
  return {
    title: "Tüm Ürünler | Bollmark",
    description: "Bollmark'ın özenle seçilmiş kumaşlarla tasarlanan tüm ürünlerini keşfedin."
  };
}

export default async function ProductsPage({
  searchParams
}: {
  searchParams: { kategori?: string };
}) {
  // Birden fazla rengi olan urunler burada renk basina ayri bir giris olarak
  // gelir (bkz. lib/catalog.ts getCatalogEntries) - musteri kataloga bakarken
  // her rengi urune tiklamadan ayri bir urunmus gibi gorur.
  const entries = await getCatalogEntries(searchParams.kategori);

  return (
    <div className="mx-auto max-w-6xl px-6 py-16">
      <h1 className="font-display text-4xl">Tüm Ürünler</h1>
      <p className="mt-2 text-ink/60">{entries.length} ürün</p>

      {entries.length === 0 ? (
        <p className="mt-10 text-ink/60">Bu kategoride henüz ürün bulunmuyor.</p>
      ) : (
        <div className="mt-10 grid grid-cols-2 gap-x-6 gap-y-12 md:grid-cols-4">
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
                colorLabel: entry.colorLabel
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
