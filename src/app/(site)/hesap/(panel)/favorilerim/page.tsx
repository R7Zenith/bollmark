import { prisma } from "@/lib/prisma";
import { requireCustomer } from "@/lib/require-customer";
import { FavorilerimGrid } from "@/components/favorilerim-grid";
import type { ProductCardData } from "@/components/product-card";
import { firstImageUrl } from "@/lib/catalog";
import { resolveProductDisplayPrice } from "@/lib/coupons";
import { usesGreyBackdrop } from "@/lib/image-backdrop";

export default async function HesapFavorilerimPage() {
  const session = await requireCustomer();
  const customerId = session.user!.id!;

  const items = await prisma.wishlistItem.findMany({
    where: { customerId },
    include: {
      product: {
        include: {
          images: { orderBy: { position: "asc" }, take: 1 },
          optionImages: { orderBy: { position: "asc" }, take: 1 },
          brand: { select: { name: true } }
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
    image: firstImageUrl(item.product) ?? "https://images.unsplash.com/photo-1445205170230-053b83016050?w=800",
    // Bu liste otomatik kampanyalari sorgulamiyor - sadece elle indirim
    // (compareAtCents) varsa yansitilir (bkz. lib/coupons.ts
    // resolveProductDisplayPrice, product-card.tsx'in tek fiyat kaynagi).
    priceResolution: resolveProductDisplayPrice([], item.product),
    greyBackdrop: usesGreyBackdrop(item.product.brand?.name)
  }));

  return (
    <div>
      <h2 className="font-display text-xl">Favorilerim</h2>

      {products.length === 0 ? (
        <p className="mt-6 text-sm text-ink/60">Henüz favori ürününüz yok.</p>
      ) : (
        <div className="mt-6">
          <FavorilerimGrid products={products} />
        </div>
      )}
    </div>
  );
}
