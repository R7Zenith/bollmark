import { getPublishedProducts } from "@/lib/catalog";
import { ProductCard } from "@/components/product-card";

export default async function ProductsPage({
  searchParams
}: {
  searchParams: { kategori?: string };
}) {
  const products = await getPublishedProducts(searchParams.kategori);

  return (
    <div className="mx-auto max-w-6xl px-6 py-16">
      <h1 className="font-display text-4xl">Tüm Ürünler</h1>
      <p className="mt-2 text-ink/60">{products.length} ürün</p>

      {products.length === 0 ? (
        <p className="mt-10 text-ink/60">Bu kategoride henüz ürün bulunmuyor.</p>
      ) : (
        <div className="mt-10 grid grid-cols-2 gap-x-6 gap-y-12 md:grid-cols-4">
          {products.map((p) => (
            <ProductCard
              key={p.id}
              product={{
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
    </div>
  );
}
