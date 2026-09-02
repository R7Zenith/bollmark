"use client";

import { useWishlist } from "@/lib/wishlist";
import { ProductCard, type ProductCardData } from "@/components/product-card";

// Favorilerim sayfasindaki listeyi useWishlist().ids ile canli filtreler -
// kalpten cikarilan bir urun sayfa yenilenmeden aninda gridden kaybolur.
export function FavorilerimGrid({ products }: { products: ProductCardData[] }) {
  const { ids } = useWishlist();
  const visible = products.filter((p) => ids.has(p.productId));

  if (visible.length === 0) {
    return <p className="mt-10 text-sm text-ink/60">Favori ürününüz kalmadı.</p>;
  }

  return (
    <div className="mt-10 grid grid-cols-2 gap-x-6 gap-y-12 md:grid-cols-4">
      {visible.map((p) => (
        <ProductCard key={p.productId} product={p} />
      ))}
    </div>
  );
}
