"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { Heart, Plus, Check } from "lucide-react";
import { formatPrice } from "@/lib/format";
import { useWishlist } from "@/lib/wishlist";
import { useCart } from "@/lib/cart";
import { ProductBadge } from "@/components/product-badge";
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
  // Doluysa (bkz. lib/catalog.ts isNewProduct) "Yeni" rozeti gosterilir.
  isNew?: boolean;
  // Doluysa karttaki "+" hizli sepete ekle butonu bu varyanti dogrudan sepete
  // ekler (bkz. lib/catalog.ts pickQuickAddVariant) - sayfa yonlendirmesi
  // olmadan. Null ise (stokta varyant yoksa) buton gizlenir.
  quickAddVariant?: QuickAddVariant;
  // Urunun (bu kart tek bir renge ait olsa bile) TUM renkleri - kartta salt
  // onizleme amacli swatch satiri icin (bkz. lib/catalog.ts CatalogEntry).
  // Bir swatch'a tiklamak yalnizca kartin gosterdigi gorseli degistirir;
  // kartin kendi rengini/hedef linkini (colorLabel/href) etkilemez.
  colors?: { name: string; hex: string; imageUrl: string | null }[];
};

export function ProductCard({ product }: { product: ProductCardData }) {
  const { ids, toggle } = useWishlist();
  const { addLine } = useCart();
  const isWishlisted = ids.has(product.productId);
  const [justAdded, setJustAdded] = useState(false);
  const colors = product.colors ?? [];
  // Kartin ana gorseli hangi renge aitse (colorLabel - bkz. lib/catalog.ts
  // getCatalogEntries, her CatalogEntry zaten tek bir renge ait) swatch
  // halkasi o renkle baslamali, dizinin ilk elemaniyla degil - aksi halde
  // ana gorsel ör. "Lacivert" gosterirken halka hep ilk renk olan
  // "Siyah"i isaretli gosterirdi. colorLabel eslesen bir renk bulamazsa
  // (ör. tek renkli urun, colorLabel null) ilk renge geri dusuluyor.
  const defaultColorIndex = product.colorLabel
    ? Math.max(
        0,
        colors.findIndex((c) => c.name === product.colorLabel)
      )
    : 0;
  const [selectedColorIndex, setSelectedColorIndex] = useState(defaultColorIndex);
  // Doluysa bir swatch manuel secilmis ve gorseli degistirmis demektir -
  // mevcut hover-ile-ikinci-fotografa gecis bu sure boyunca duraklar (asagida
  // previewImage kullanilir, secondImage crossfade'i devre disi kalir).
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  function handleSwatchClick(e: React.MouseEvent, index: number) {
    e.preventDefault();
    e.stopPropagation();
    setSelectedColorIndex(index);
    const imageUrl = colors[index]?.imageUrl;
    if (imageUrl) setPreviewImage(imageUrl);
  }

  function resetSwatchPreview() {
    setPreviewImage(null);
    setSelectedColorIndex(defaultColorIndex);
  }
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
      compareAtCents: product.automaticDiscountPercent
        ? product.priceCents
        : compareAtDiscountPercent
          ? product.compareAtCents
          : null,
      image: product.image,
      quantity: 1
    });
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1500);
  };

  return (
    <Link href={href} className="group block" onMouseLeave={resetSwatchPreview}>
      <div className="relative aspect-[3/4] overflow-hidden bg-line">
        <Image
          src={previewImage ?? product.image}
          alt={product.name}
          fill
          sizes="(min-width: 1024px) 25vw, 50vw"
          className={
            !previewImage && product.secondImage
              ? "object-cover transition duration-700 [transition-timing-function:ease] group-hover:opacity-0"
              : "object-cover transition duration-700 [transition-timing-function:ease] group-hover:scale-105"
          }
        />
        {!previewImage && product.secondImage && (
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
        {(discountPercent || product.isNew || product.lowStockCount != null) && (
          <div className="absolute left-2 top-2 flex max-w-[calc(100%-3rem)] flex-row flex-wrap items-start gap-1 sm:left-3 sm:top-3 sm:gap-1.5">
            {discountPercent && <ProductBadge variant="discount">%{discountPercent} İndirim</ProductBadge>}
            {product.isNew && <ProductBadge variant="new">Yeni</ProductBadge>}
            {product.lowStockCount != null && (
              <ProductBadge variant="low-stock">Son {product.lowStockCount} Adet</ProductBadge>
            )}
          </div>
        )}
        {product.quickAddVariant && !product.outOfStock && (
          <button
            type="button"
            onClick={handleQuickAdd}
            title="Hızlı sepete ekle"
            aria-label="Sepete ekle"
            className="absolute bottom-2 right-2 flex h-8 w-8 items-center justify-center rounded-full bg-ink text-cream opacity-100 transition hover:bg-clay sm:bottom-3 sm:right-3 md:h-9 md:w-9 md:opacity-0 md:group-hover:opacity-100"
          >
            {justAdded ? <Check className="h-3.5 w-3.5 md:h-4 md:w-4" /> : <Plus className="h-3.5 w-3.5 md:h-4 md:w-4" />}
          </button>
        )}
      </div>
      <div className="mt-4 flex items-baseline justify-between px-2 md:px-0">
        <h3 className="line-clamp-2 min-h-[30px] text-[12px] font-semibold uppercase leading-[15px] tracking-[0.48px] text-ink">
          {product.name}
        </h3>
      </div>
      <p
        className={`mt-0.5 min-h-[15px] px-2 text-[12px] leading-[15px] text-ink/50 md:px-0 ${product.colorLabel ? "" : "invisible"}`}
        aria-hidden={product.colorLabel ? undefined : true}
      >
        {product.colorLabel || " "}
      </p>
      <div className="mt-1 flex items-center gap-2 px-2 md:px-0">
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
      {colors.length > 1 && (
        <div className="mt-2 flex items-center gap-1.5 px-2 md:px-0">
          {colors.slice(0, 4).map((color, index) => (
            <button
              key={color.name}
              type="button"
              onClick={(e) => handleSwatchClick(e, index)}
              aria-label={color.name}
              title={color.name}
              className="flex h-6 w-6 shrink-0 items-center justify-center"
            >
              <span
                className={`block h-[18px] w-[18px] rounded-full border ${
                  index === selectedColorIndex ? "ring-2 ring-ink ring-offset-2 ring-offset-cream" : ""
                }`}
                style={{ backgroundColor: color.hex, borderColor: "rgba(17,17,17,0.15)" }}
              />
            </button>
          ))}
          {colors.length > 4 && <span className="text-[10px] text-ink/50">+{colors.length - 4}</span>}
        </div>
      )}
    </Link>
  );
}
