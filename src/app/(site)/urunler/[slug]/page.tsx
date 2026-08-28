import Image from "next/image";
import { notFound } from "next/navigation";
import { getProductBySlug } from "@/lib/catalog";
import { formatPrice } from "@/lib/format";
import { AddToCart } from "@/components/add-to-cart";

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product || product.status !== "PUBLISHED") notFound();

  const mainImage =
    product.images[0]?.url ?? "https://images.unsplash.com/photo-1445205170230-053b83016050?w=1200";

  return (
    <div className="mx-auto max-w-6xl px-6 py-16">
      <div className="grid gap-12 md:grid-cols-2">
        <div className="grid gap-4">
          {product.images.length > 0 ? (
            product.images.map((img) => (
              <div key={img.id} className="relative aspect-[3/4] overflow-hidden bg-line">
                <Image src={img.url} alt={img.alt || product.name} fill className="object-cover" />
              </div>
            ))
          ) : (
            <div className="relative aspect-[3/4] overflow-hidden bg-line">
              <Image src={mainImage} alt={product.name} fill className="object-cover" />
            </div>
          )}
        </div>

        <div>
          {product.category && (
            <p className="text-xs uppercase tracking-widest2 text-accent">{product.category.name}</p>
          )}
          <h1 className="mt-2 font-display text-4xl">{product.name}</h1>
          <div className="mt-4 flex items-center gap-3">
            <span className="text-xl">{formatPrice(product.priceCents)}</span>
            {product.compareAtCents && product.compareAtCents > product.priceCents && (
              <span className="text-ink/40 line-through">{formatPrice(product.compareAtCents)}</span>
            )}
          </div>
          <p className="mt-6 leading-relaxed text-ink/70">{product.description}</p>

          <AddToCart
            productId={product.id}
            name={product.name}
            priceCents={product.priceCents}
            image={mainImage}
            variants={product.variants}
          />
        </div>
      </div>
    </div>
  );
}
