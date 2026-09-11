"use client";

import Link from "next/link";
import Image from "next/image";
import { Heart } from "lucide-react";
import { formatPrice } from "@/lib/format";
import { useWishlist } from "@/lib/wishlist";

export type ProductCardData = {
  productId: string;
  slug: string;
  name: string;
  priceCents: number;
  compareAtCents?: number | null;
  image: string;
  // Dolu ise urunun birden fazla rengi vardir ve bu kart o renge ait bir
  // katalog girisidir - urun sayfasina bu renk onceden secili acilir
  // (bkz. lib/catalog.ts getCatalogEntries, product-viewer.tsx initialColor).
  colorLabel?: string | null;
  // Urunun kategori/markasina uyan aktif bir otomatik kampanya varsa yuzdesi
  // (bkz. lib/coupons.ts matchAutomaticDiscount) - doluysa fiyatin yaninda
  // indirimli fiyat + rozet gosterilir.
  automaticDiscountPercent?: number | null;
  // Doluysa bu urunun/rengin tum varyantlarinin stogu bitmis, kart soluk bir
  // cam katmaniyla isaretlenir.
  outOfStock?: boolean;
};

export function ProductCard({ product }: { product: ProductCardData }) {
  const { ids, toggle } = useWishlist();
  const isWishlisted = ids.has(product.productId);
  const href = product.colorLabel
    ? `/urunler/${product.slug}?renk=${encodeURIComponent(product.colorLabel)}`
    : `/urunler/${product.slug}`;
  const discountPercent = product.automaticDiscountPercent;
  const discountedPriceCents = discountPercent
    ? Math.round((product.priceCents * (100 - discountPercent)) / 100)
    : null;

  return (
    <Link href={href} className="group block">
      <div className="relative aspect-[3/4] overflow-hidden bg-line">
        <Image
          src={product.image}
          alt={product.name}
          fill
          sizes="(min-width: 1024px) 25vw, 50vw"
          className="object-cover transition duration-500 group-hover:scale-105"
        />
        {product.outOfStock && (
          <div className="absolute inset-0 flex items-center justify-center bg-paper/60 backdrop-blur-[2px]">
            <span className="border border-ink/20 bg-paper/85 px-3 py-1 text-xs uppercase tracking-wide text-ink/70">
              Stokta Yok
            </span>
          </div>
        )}
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            toggle(product.productId);
          }}
          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-paper/90 text-ink transition hover:bg-paper"
          title={isWishlisted ? "Favorilerden çıkar" : "Favorilere ekle"}
        >
          <Heart size={16} fill={isWishlisted ? "currentColor" : "none"} />
        </button>
        {discountPercent && (
          <span className="absolute left-3 top-3 bg-accent px-2 py-1 text-xs font-medium uppercase tracking-wide text-paper">
            %{discountPercent} İndirim
          </span>
        )}
      </div>
      <div className="mt-3 flex items-baseline justify-between">
        <h3 className="text-sm uppercase tracking-wide">{product.name}</h3>
      </div>
      {product.colorLabel && <p className="mt-0.5 text-xs text-ink/50">{product.colorLabel}</p>}
      <div className="mt-1 flex items-center gap-2">
        <span className="text-sm font-medium">
          {formatPrice(discountedPriceCents ?? product.priceCents)}
        </span>
        {discountedPriceCents != null ? (
          <span className="text-xs text-ink/40 line-through">{formatPrice(product.priceCents)}</span>
        ) : (
          product.compareAtCents &&
          product.compareAtCents > product.priceCents && (
            <span className="text-xs text-ink/40 line-through">
              {formatPrice(product.compareAtCents)}
            </span>
          )
        )}
      </div>
    </Link>
  );
}
