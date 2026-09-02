import { prisma } from "@/lib/prisma";
import { requireCustomer } from "@/lib/require-customer";
import { HesapNav } from "@/components/hesap-nav";
import { FavorilerimGrid } from "@/components/favorilerim-grid";
import type { ProductCardData } from "@/components/product-card";
import { firstImageUrl } from "@/lib/catalog";

export default async function HesapFavorilerimPage() {
  const session = await requireCustomer();
  const customerId = session.user!.id!;

  const items = await prisma.wishlistItem.findMany({
    where: { customerId },
    include: {
      product: {
        include: {
          images: { orderBy: { position: "asc" }, take: 1 },
          optionImages: { orderBy: { position: "asc" }, take: 1 }
        }
      }
    },
    orderBy: { createdAt: "desc" }
  });

  const products: ProductCardData[] = items.map((item) => ({
    productId: item.product.id,
    slug: item.product.slug,
    name: item.product.name,
    priceCents: item.product.priceCents,
    compareAtCents: item.product.compareAtCents,
    image: firstImageUrl(item.product) ?? "https://images.unsplash.com/photo-1445205170230-053b83016050?w=800"
  }));

  return (
    <div className="mx-auto max-w-6xl px-6 py-16">
      <h1 className="font-display text-3xl">Favorilerim</h1>
      <div className="mt-8">
        <HesapNav />
      </div>

      {products.length === 0 ? (
        <p className="mt-10 text-sm text-ink/60">Henüz favori ürününüz yok.</p>
      ) : (
        <FavorilerimGrid products={products} />
      )}
    </div>
  );
}
