"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { Heart, Plus, Check, X } from "lucide-react";
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
  // Manuel indirim (compareAtCents) ile kategori/marka bazli otomatik
  // kampanyadan hangisi musteriye daha avantajliysa onu yansitir - ikisi asla
  // ust uste uygulanmaz (bkz. lib/coupons.ts resolveProductDisplayPrice, tum
  // katalog/urun sayfalarinin bu karti besledigi ortak fonksiyon).
  priceResolution: {
    finalPriceCents: number;
    originalPriceCents: number | null;
    badgePercent: number | null;
  };
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
  // Doluysa karttaki "+" hizli sepete ekle butonu stoktaki bu bedenleri sunar
  // (bkz. lib/catalog.ts pickQuickAddVariants) - sayfa yonlendirmesi olmadan.
  // Tek eleman varsa direkt sepete eklenir, birden fazlaysa beden secim kutusu
  // acilir. Bos/undefined ise (stokta varyant yoksa) buton gizlenir.
  quickAddVariants?: QuickAddVariant[];
  // Urunun (bu kart tek bir renge ait olsa bile) TUM renkleri - kartta salt
  // onizleme amacli swatch satiri icin (bkz. lib/catalog.ts CatalogEntry).
  // Bir swatch'a tiklamak yalnizca kartin gosterdigi gorseli degistirir;
  // kartin kendi rengini/hedef linkini (colorLabel/href) etkilemez.
  colors?: { name: string; hex: string; imageUrl: string | null }[];
  // Doluysa gorsel gri zemin + mix-blend-multiply ile gosterilir (beyaz
  // arkaplanli marka fotograflari icin - bkz. lib/image-backdrop.ts).
  greyBackdrop?: boolean;
};

export function ProductCard({ product }: { product: ProductCardData }) {
  const { ids, toggle } = useWishlist();
  const { addLine } = useCart();
  const isWishlisted = ids.has(product.productId);
  const [justAdded, setJustAdded] = useState(false);
  const [sizePickerOpen, setSizePickerOpen] = useState(false);
  const sizePickerRef = useRef<HTMLDivElement>(null);
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
  const { finalPriceCents, originalPriceCents, badgePercent: discountPercent } = product.priceResolution;
  // Sepete elle indirim eklenirken (compareAtCents), otomatik kampanya
  // kazanmis olsa bile bu satirin "eski fiyati" hala manuel karsilastirma
  // fiyatidir - kampanya sepete asla gomulmuyor (bkz. asagidaki not).
  const compareAtDiscountPercent =
    product.compareAtCents && product.compareAtCents > product.priceCents
      ? Math.round((1 - product.priceCents / product.compareAtCents) * 100)
      : null;

  const addVariantToCart = (variant: QuickAddVariant) => {
    // Sepete otomatik kampanya indirimi UYGULANMADAN eklenir - kampanya
    // indirimi sadece bu kartta bilgilendirici bir rozet/fiyat gosterimidir
    // (bkz. product-viewer.tsx'teki ayni isimli not); gercek indirim sepet
    // sayfasinda CouponField'in her zaman (kod girilmese bile) sorguladigi
    // resolveBestDiscount ile ayri bir "Indirim" satiri olarak dusulur. Buraya
    // indirimli fiyati priceCents olarak yazmak, sepet sayfasindaki toplamdan
    // indirimi IKI KEZ dusurur (bir kez burada, bir kez o satirda).
    addLine({
      productId: product.productId,
      variantId: variant.variantId,
      name: product.name,
      size: variant.size,
      color: variant.color,
      priceCents: product.priceCents,
      compareAtCents: compareAtDiscountPercent ? product.compareAtCents : null,
      image: product.image,
      quantity: 1,
      greyBackdrop: product.greyBackdrop
    });
    setSizePickerOpen(false);
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1500);
  };

  const handleQuickAddClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const variants = product.quickAddVariants ?? [];
    if (variants.length === 0 || justAdded) return;
    if (variants.length === 1) {
      addVariantToCart(variants[0]);
      return;
    }
    setSizePickerOpen((open) => !open);
  };

  const handleSizeSelect = (e: React.MouseEvent, variant: QuickAddVariant) => {
    e.preventDefault();
    e.stopPropagation();
    addVariantToCart(variant);
  };

  useEffect(() => {
    if (!sizePickerOpen) return;
    const handleMouseDown = (e: MouseEvent) => {
      if (sizePickerRef.current && !sizePickerRef.current.contains(e.target as Node)) {
        setSizePickerOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSizePickerOpen(false);
    };
    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [sizePickerOpen]);

  return (
    <Link href={href} className="group block" onMouseLeave={resetSwatchPreview}>
      <div className={`relative aspect-[3/4] overflow-hidden ${product.greyBackdrop ? "bg-image-bg" : "bg-line"}`}>
        <Image
          src={previewImage ?? product.image}
          alt={product.name}
          fill
          sizes="(min-width: 1024px) 25vw, 50vw"
          className={`${
            !previewImage && product.secondImage
              ? "object-cover transition duration-700 [transition-timing-function:ease] group-hover:opacity-0"
              : "object-cover transition duration-700 [transition-timing-function:ease] group-hover:scale-105"
          }${product.greyBackdrop ? " mix-blend-multiply" : ""}`}
        />
        {!previewImage && product.secondImage && (
          <Image
            src={product.secondImage}
            alt={product.name}
            fill
            sizes="(min-width: 1024px) 25vw, 50vw"
            className={`object-cover opacity-0 transition duration-700 [transition-timing-function:ease] group-hover:opacity-100${product.greyBackdrop ? " mix-blend-multiply" : ""}`}
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
        {product.quickAddVariants && product.quickAddVariants.length > 0 && !product.outOfStock && (
          <div ref={sizePickerRef} className="absolute bottom-2 right-2 sm:bottom-3 sm:right-3">
            <button
              type="button"
              onClick={handleQuickAddClick}
              title="Hızlı sepete ekle"
              aria-label="Sepete ekle"
              className="relative z-10 flex h-8 w-8 items-center justify-center rounded-full bg-ink text-cream opacity-100 transition hover:bg-clay sm:h-8 sm:w-8 md:h-9 md:w-9 md:opacity-0 md:group-hover:opacity-100"
            >
              {justAdded ? (
                <Check className="h-3.5 w-3.5 md:h-4 md:w-4" />
              ) : sizePickerOpen ? (
                <X className="h-3.5 w-3.5 md:h-4 md:w-4" />
              ) : (
                <Plus className="h-3.5 w-3.5 md:h-4 md:w-4" />
              )}
            </button>
            <div
              className={`absolute bottom-full right-0 z-20 mb-2.5 origin-bottom-right rounded-xl bg-cream p-2 shadow-soft transition-all duration-200 ease-out ${
                sizePickerOpen ? "translate-y-0 scale-100 opacity-100" : "pointer-events-none translate-y-1 scale-95 opacity-0"
              }`}
            >
              <span className="absolute -bottom-[5px] right-[13px] h-2.5 w-2.5 rotate-45 bg-cream" />
              <div className="relative flex max-w-[152px] flex-wrap justify-end gap-1.5">
                {product.quickAddVariants.map((variant) => (
                  <button
                    key={variant.variantId}
                    type="button"
                    onClick={(e) => handleSizeSelect(e, variant)}
                    className="flex h-7 min-w-[28px] items-center justify-center rounded-md border border-ink px-1.5 text-[11px] leading-none tracking-[0.4px] text-ink transition-colors hover:bg-ink hover:text-cream"
                  >
                    {variant.size}
                  </button>
                ))}
              </div>
            </div>
          </div>
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
        {originalPriceCents != null && (
          <span className="text-[12px] tracking-[0.48px] text-ink line-through">
            {formatPrice(originalPriceCents)}
          </span>
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
              className="flex h-7 w-7 shrink-0 items-center justify-center"
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
