"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { Heart, Plus, Check } from "lucide-react";
import { formatPrice } from "@/lib/format";
import { useWishlist } from "@/lib/wishlist";
import { useCart } from "@/lib/cart";
import type { QuickAddVariant } from "@/lib/catalog";

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
  // indirimli fiyat + rozet gosterilir. Bos olsa da compareAtCents > priceCents
  // ise indirim rozeti yine gosterilir (bkz. asagidaki discountPercent hesabi).
  automaticDiscountPercent?: number | null;
  // Doluysa bu urunun/rengin tum varyantlarinin stogu bitmis, kart soluk bir
  // cam katmaniyla isaretlenir.
  outOfStock?: boolean;
  // Doluysa hover'da ana gorselden buna capraz-solma (crossfade) yapilir;
  // bos ise mevcut hafif buyume (scale) efekti kullanilir.
  secondImage?: string | null;
  // Doluysa (0 hariç, ör. 2) toplam stok dusuk demektir - indirim rozetinin
  // yaninda "Son X Adet" uyarisi gosterilir. outOfStock true ise bu rozet
  // hic render edilmez (tam ekran "Stokta Yok" katmani zaten oncelikli).
  lowStockCount?: number | null;
  // Doluysa karttaki "+" hizli sepete ekle butonu bu varyanti dogrudan sepete
  // ekler (bkz. lib/catalog.ts pickQuickAddVariant) - sayfa yonlendirmesi
  // olmadan. Null ise (stokta varyant yoksa) buton gizlenir.
  quickAddVariant?: QuickAddVariant;
};

export function ProductCard({ product }: { product: ProductCardData }) {
  const { ids, toggle } = useWishlist();
  const { addLine } = useCart();
  const isWishlisted = ids.has(product.productId);
  const [justAdded, setJustAdded] = useState(false);
  const href = product.colorLabel
    ? `/urunler/${product.slug}?renk=${encodeURIComponent(product.colorLabel)}`
    : `/urunler/${product.slug}`;
  // Otomatik kampanya indirimi varsa o oncelikli (priceCents uzerinden
  // yuzde hesaplanip dusuruluyor); yoksa admin panelinden dogrudan girilen
  // "Karsilastirma fiyati" (compareAtCents) da bir indirim sayilir - bu
  // durumda priceCents zaten indirimli fiyattir, sadece rozette gosterilecek
  // yuzde compareAtCents'e gore hesaplanir (bkz. KATALOG_ROZET_HOVER_PLANI.md 2.1).
  const compareAtDiscountPercent =
    product.compareAtCents && product.compareAtCents > product.priceCents
      ? Math.round((1 - product.priceCents / product.compareAtCents) * 100)
      : null;
  const discountPercent = product.automaticDiscountPercent ?? compareAtDiscountPercent;
  const discountedPriceCents = product.automaticDiscountPercent
    ? Math.round((product.priceCents * (100 - product.automaticDiscountPercent)) / 100)
    : null;
  const finalPriceCents = discountedPriceCents ?? product.priceCents;

  const handleQuickAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!product.quickAddVariant || justAdded) return;
    addLine({
      productId: product.productId,
      variantId: product.quickAddVariant.variantId,
      name: product.name,
      size: product.quickAddVariant.size,
      color: product.quickAddVariant.color,
      priceCents: finalPriceCents,
      image: product.image,
      quantity: 1
    });
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1500);
  };

  return (
    <Link href={href} className="group block">
      <div className="relative aspect-[3/4] overflow-hidden bg-line">
        <Image
          src={product.image}
          alt={product.name}
          fill
          sizes="(min-width: 1024px) 25vw, 50vw"
          className={
            product.secondImage
              ? "object-cover transition duration-700 [transition-timing-function:ease] group-hover:opacity-0"
              : "object-cover transition duration-700 [transition-timing-function:ease] group-hover:scale-105"
          }
        />
        {product.secondImage && (
          <Image
            src={product.secondImage}
            alt={product.name}
            fill
            sizes="(min-width: 1024px) 25vw, 50vw"
            className="object-cover opacity-0 transition duration-700 [transition-timing-function:ease] group-hover:opacity-100"
          />
        )}
        {product.outOfStock && (
          <div className="absolute inset-0 flex items-center justify-center bg-cream/60 backdrop-blur-[2px]">
            <span className="border border-ink/20 bg-cream/85 px-3 py-1 text-xs uppercase tracking-wide text-ink/70">
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
          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-cream/90 text-ink transition hover:bg-cream"
          title={isWishlisted ? "Favorilerden çıkar" : "Favorilere ekle"}
        >
          <Heart size={16} fill={isWishlisted ? "currentColor" : "none"} />
        </button>
        {(discountPercent || product.lowStockCount != null) && (
          <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
            {discountPercent && (
              <span className="rounded bg-[rgb(239,45,45)] px-2 py-1.5 text-[10px] font-medium uppercase leading-[12.5px] tracking-[1.4px] text-white">
                %{discountPercent} İndirim
              </span>
            )}
            {product.lowStockCount != null && (
              <span className="rounded bg-white px-2 py-1.5 text-[10px] font-medium uppercase leading-[12.5px] tracking-[1.4px] text-ink">
                Son {product.lowStockCount} Adet
              </span>
            )}
          </div>
        )}
        {product.quickAddVariant && !product.outOfStock && (
          <button
            type="button"
            onClick={handleQuickAdd}
            title="Hızlı sepete ekle"
            aria-label="Sepete ekle"
            className="absolute bottom-3 right-3 flex h-9 w-9 items-center justify-center rounded-full bg-ink text-cream opacity-100 transition hover:bg-clay md:opacity-0 md:group-hover:opacity-100"
          >
            {justAdded ? <Check size={16} /> : <Plus size={16} />}
          </button>
        )}
      </div>
      <div className="mt-4 flex items-baseline justify-between">
        <h3 className="text-[12px] font-semibold uppercase leading-[15px] tracking-[0.48px] text-ink">
          {product.name}
        </h3>
      </div>
      {product.colorLabel && <p className="mt-1 text-[12px] text-ink/50">{product.colorLabel}</p>}
      <div className="mt-2 flex items-center gap-2">
        <span
          className={`text-[12px] tracking-[0.48px] ${discountPercent ? "text-[rgb(194,81,81)]" : "text-ink"}`}
        >
          {formatPrice(finalPriceCents)}
        </span>
        {discountedPriceCents != null ? (
          <span className="text-[12px] tracking-[0.48px] text-ink line-through">
            {formatPrice(product.priceCents)}
          </span>
        ) : (
          product.compareAtCents &&
          product.compareAtCents > product.priceCents && (
            <span className="text-[12px] tracking-[0.48px] text-ink line-through">
              {formatPrice(product.compareAtCents)}
            </span>
          )
        )}
      </div>
    </Link>
  );
}
