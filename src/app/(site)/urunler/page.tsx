import type { Metadata } from "next";
import { getCatalogEntries } from "@/lib/catalog";
import { prisma } from "@/lib/prisma";
import { ProductCard } from "@/components/product-card";
import { getActiveAutomaticPercentCampaigns, matchAutomaticDiscount } from "@/lib/coupons";

const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1445205170230-053b83016050?w=800";

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
  searchParams: Promise<{ kategori?: string; cinsiyet?: string }>;
}) {
  const { kategori, cinsiyet } = await searchParams;

  // Birden fazla rengi olan urunler burada renk basina ayri bir giris olarak
  // gelir (bkz. lib/catalog.ts getCatalogEntries) - musteri kataloga bakarken
  // her rengi urune tiklamadan ayri bir urunmus gibi gorur.
  const [entries, automaticCampaigns] = await Promise.all([
    getCatalogEntries(kategori, { genderLabel: cinsiyet }),
    getActiveAutomaticPercentCampaigns(prisma)
  ]);

  const heading = cinsiyet ? `${cinsiyet} Koleksiyonu` : "Tüm Ürünler";
  const emptyMessage = cinsiyet
    ? `${cinsiyet} koleksiyonunda bu kategoride henüz ürün bulunmuyor.`
    : "Bu kategoride henüz ürün bulunmuyor.";

  return (
    <div className="mx-auto max-w-6xl px-6 py-16">
      <h1 className="font-display text-4xl">{heading}</h1>
      <p className="mt-2 text-ink/60">{entries.length} ürün</p>

      {entries.length === 0 ? (
        <p className="mt-10 text-ink/60">{emptyMessage}</p>
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
                colorLabel: entry.colorLabel,
                automaticDiscountPercent: matchAutomaticDiscount(automaticCampaigns, entry)?.percent ?? null
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
