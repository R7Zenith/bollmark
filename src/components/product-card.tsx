import Link from "next/link";
import Image from "next/image";
import { formatPrice } from "@/lib/format";

export type ProductCardData = {
  slug: string;
  name: string;
  priceCents: number;
  compareAtCents?: number | null;
  image: string;
};

export function ProductCard({ product }: { product: ProductCardData }) {
  return (
    <Link href={`/urunler/${product.slug}`} className="group block">
      <div className="relative aspect-[3/4] overflow-hidden bg-line">
        <Image
          src={product.image}
          alt={product.name}
          fill
          sizes="(min-width: 1024px) 25vw, 50vw"
          className="object-cover transition duration-500 group-hover:scale-105"
        />
      </div>
      <div className="mt-3 flex items-baseline justify-between">
        <h3 className="text-sm uppercase tracking-wide">{product.name}</h3>
      </div>
      <div className="mt-1 flex items-center gap-2">
        <span className="text-sm font-medium">{formatPrice(product.priceCents)}</span>
        {product.compareAtCents && product.compareAtCents > product.priceCents && (
          <span className="text-xs text-ink/40 line-through">
            {formatPrice(product.compareAtCents)}
          </span>
        )}
      </div>
    </Link>
  );
}
