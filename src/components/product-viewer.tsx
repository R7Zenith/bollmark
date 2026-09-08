"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Heart } from "lucide-react";
import { useCart } from "@/lib/cart";
import { useWishlist } from "@/lib/wishlist";
import { formatPrice } from "@/lib/format";
import { effectivePrice } from "@/lib/variant";

// Bu esikten dusuk stok "Son N adet" uyarisi gosterir - e-posta gerektirmeyen
// salt UI bir isaret. Ileride StoreSettings'e tasinabilir (Faz A'ya dahil degil).
const LOW_STOCK_THRESHOLD = 3;

// Stokta olmayan bir varyant secildiginde gosterilen "stok gelince haber ver"
// formu. Kendi basina basari/hata durumunu yonetir, urun bilgisini disaridan
// bilmesine gerek yok - sadece secili varyantin id'sini kullanir.
function StockAlertForm({ variantId }: { variantId: string }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (status === "loading") return;
    setStatus("loading");
    try {
      const res = await fetch("/api/stok-bildirimi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ variantId, email })
      });
      if (!res.ok) throw new Error();
      setStatus("success");
    } catch {
      setStatus("error");
    }
  };

  if (status === "success") {
    return <p className="text-sm text-ink/70">Stok gelince size haber vereceğiz.</p>;
  }

  return (
    <div>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="E-posta adresiniz"
          className="w-full border border-line px-4 py-2.5 text-sm focus:border-ink focus:outline-none"
        />
        <button
          type="submit"
          disabled={status === "loading"}
          className="shrink-0 border border-ink px-4 py-2.5 text-sm uppercase tracking-wide hover:bg-ink hover:text-paper disabled:opacity-40"
        >
          Haber Ver
        </button>
      </form>
      {status === "error" && <p className="mt-2 text-sm text-red-600">Bir şeyler ters gitti, tekrar deneyin.</p>}
    </div>
  );
}

type Variant = {
  id: string;
  size: string;
  sizePosition: number;
  color: string;
  colorPosition: number;
  colorValueId: string | null;
  stock: number;
  priceCents: number | null;
};

// Bir varyant eksenindeki (Beden/Renk) benzersiz degerleri, admin panelinde
// tanimlanan VariantAttributeValue.position sirasina gore (kucukten buyuge)
// dondurur.
function orderedOptionValues(variants: Variant[], value: (v: Variant) => string, position: (v: Variant) => number) {
  const positionByValue = new Map<string, number>();
  for (const v of variants) {
    const val = value(v);
    if (!val || positionByValue.has(val)) continue;
    positionByValue.set(val, position(v));
  }
  return Array.from(positionByValue.entries())
    .sort((a, b) => a[1] - b[1])
    .map(([val]) => val);
}

// Renk secimine gore galeriyi ve sepete ekleme akisini ortak state altinda
// birlestiren bilesen. Secili rengin ProductOptionImage seti varsa galeri
// onu gosterir, yoksa urunun genel gorsellerine duser (fallback).
export function ProductViewer({
  productId,
  productName,
  categoryName,
  brandName,
  descriptionHtml,
  material,
  origin,
  careInstructions,
  sizeGuide,
  priceCents,
  compareAtCents,
  fallbackImages,
  colorGalleries,
  variants,
  bundleInfo,
  automaticDiscount,
  initialColor
}: {
  productId: string;
  productName: string;
  categoryName: string | null;
  brandName: string | null;
  descriptionHtml: string;
  material: string | null;
  origin: string | null;
  careInstructions: string | null;
  sizeGuide: string | null;
  priceCents: number;
  compareAtCents: number | null;
  fallbackImages: { url: string; alt: string }[];
  colorGalleries: Record<string, string[]>;
  variants: Variant[];
  bundleInfo?: { discountPercent: number; otherProductNames: string[] } | null;
  // Urunun kategori/markasina uyan aktif bir otomatik kampanya varsa - bkz.
  // lib/coupons.ts getApplicableAutomaticDiscountForProduct. Yalnizca
  // bilgilendirici bir rozet/gorunur fiyat icindir; sepetteki gercek indirim
  // yine de siparis olusturulurken resolveBestDiscount ile hesaplanir.
  automaticDiscount?: { percent: number; name: string | null } | null;
  // Katalogdan "?renk=..." ile gelindiginde o rengin onceden secili acilmasi
  // icin (bkz. urunler/[slug]/page.tsx, lib/catalog.ts getCatalogEntries).
  // Gecersiz/eslesmeyen bir deger gelirse sessizce ilk renge dusulur.
  initialColor?: string;
}) {
  const { addLine } = useCart();
  const { ids: wishlistIds, isAuthenticated, toggle: toggleWishlist } = useWishlist();
  const router = useRouter();
  const isWishlisted = wishlistIds.has(productId);

  const sizes = orderedOptionValues(variants, (v) => v.size, (v) => v.sizePosition);
  const colors = orderedOptionValues(variants, (v) => v.color, (v) => v.colorPosition);
  const startColor = initialColor && colors.includes(initialColor) ? initialColor : (colors[0] ?? "");
  const [color, setColor] = useState(startColor);
  const [size, setSize] = useState(() => {
    // Baslangic rengi icin stokta olan bir beden varsa onu sec, yoksa o renge
    // ait ilk bedeni - sizes[0] her zaman bu renkte olmayabilir (ozellikle
    // katalogdan bir renge tiklanip gelindiginde).
    const inStockForColor = variants.find((v) => v.color === startColor && v.stock > 0);
    if (inStockForColor) return inStockForColor.size;
    const anyForColor = variants.find((v) => v.color === startColor);
    return anyForColor?.size ?? sizes[0] ?? "";
  });
  const [added, setAdded] = useState(false);

  const selected = variants.find((v) => v.size === size && v.color === color);
  const outOfStock = !selected || selected.stock <= 0;
  const selectedPriceCents = selected ? effectivePrice({ priceCents }, selected) : priceCents;

  const selectedColorValueId =
    variants.find((v) => v.color === color)?.colorValueId ?? null;

  const galleryImages = useMemo(() => {
    const urls = selectedColorValueId ? colorGalleries[selectedColorValueId] : undefined;
    if (urls && urls.length > 0) return urls.map((url) => ({ url, alt: productName }));
    if (fallbackImages.length > 0) return fallbackImages;
    return [{ url: "https://images.unsplash.com/photo-1445205170230-053b83016050?w=1200", alt: productName }];
  }, [selectedColorValueId, colorGalleries, fallbackImages, productName]);

  const handleAdd = () => {
    if (!selected || outOfStock) return;
    addLine({
      productId,
      variantId: selected.id,
      name: productName,
      size,
      color,
      priceCents: selectedPriceCents,
      image: galleryImages[0].url,
      quantity: 1
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 1800);
  };

  return (
    <div className="grid gap-12 md:grid-cols-2">
      <div className="grid gap-4">
        {galleryImages.map((img, i) => (
          <div key={`${img.url}-${i}`} className="relative aspect-[3/4] overflow-hidden bg-line">
            <Image src={img.url} alt={img.alt} fill className="object-cover" />
          </div>
        ))}
      </div>

      <div>
        {(categoryName || brandName) && (
          <p className="text-xs uppercase tracking-widest2 text-accent">
            {[categoryName, brandName].filter(Boolean).join(" · ")}
          </p>
        )}
        <div className="mt-2 flex items-start justify-between gap-3">
          <h1 className="font-display text-4xl">{productName}</h1>
          <button
            type="button"
            onClick={() => toggleWishlist(productId)}
            className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-line hover:border-ink"
            title={isWishlisted ? "Favorilerden çıkar" : "Favorilere ekle"}
          >
            <Heart size={18} fill={isWishlisted ? "currentColor" : "none"} />
          </button>
        </div>
        {!isAuthenticated && (
          <p className="mt-1 text-xs text-ink/50">
            Favorileriniz bu cihazda saklanıyor, kalıcı olması için giriş yapın.
          </p>
        )}
        <div className="mt-4 flex items-center gap-3">
          {automaticDiscount ? (
            <>
              <span className="text-xl">
                {formatPrice(Math.round((selectedPriceCents * (100 - automaticDiscount.percent)) / 100))}
              </span>
              <span className="text-ink/40 line-through">{formatPrice(selectedPriceCents)}</span>
              <span className="bg-accent px-2 py-1 text-xs font-medium uppercase tracking-wide text-paper">
                %{automaticDiscount.percent} İndirim
              </span>
            </>
          ) : (
            <>
              <span className="text-xl">{formatPrice(selectedPriceCents)}</span>
              {compareAtCents && compareAtCents > selectedPriceCents && (
                <span className="text-ink/40 line-through">{formatPrice(compareAtCents)}</span>
              )}
            </>
          )}
        </div>
        {bundleInfo && bundleInfo.otherProductNames.length > 0 && (
          <p className="mt-3 border border-accent/40 bg-accent/5 px-4 py-2.5 text-sm text-ink/80">
            Bu ürünü <span className="font-medium">{bundleInfo.otherProductNames.join(", ")}</span> ile birlikte al, %
            {bundleInfo.discountPercent} indirim kazan.
          </p>
        )}
        {descriptionHtml && (
          // descriptionHtml sunucuda sanitizeDescriptionHtml() ile temizleniyor
          // (bkz. urunler/[slug]/page.tsx) - burada tekrar sanitize etmeye gerek yok.
          // eslint-disable-next-line react/no-danger
          <div
            className="prose-description mt-6 leading-relaxed text-ink/70 [&_p]:mb-3 [&_p:last-child]:mb-0 [&>strong]:mb-1 [&>strong]:mt-4 [&>strong]:block [&>strong:first-child]:mt-0"
            dangerouslySetInnerHTML={{ __html: descriptionHtml }}
          />
        )}

        {(material || origin || careInstructions) && (
          <div className="mt-6 space-y-1 border-t border-line pt-6 text-sm text-ink/70">
            {material && (
              <p>
                <span className="font-medium text-ink">Materyal:</span> {material}
              </p>
            )}
            {origin && (
              <p>
                <span className="font-medium text-ink">Menşei:</span> {origin}
              </p>
            )}
            {careInstructions && (
              <p>
                <span className="font-medium text-ink">Bakım:</span> {careInstructions}
              </p>
            )}
          </div>
        )}

        {sizeGuide && (
          <div className="mt-6 border-t border-line pt-6">
            <p className="text-xs uppercase tracking-wide text-ink/60">Beden Tablosu</p>
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-ink/70">{sizeGuide}</p>
          </div>
        )}

        <div className="mt-8 space-y-6">
          {colors.length > 0 && colors.some(Boolean) && (
            <div>
              <p className="text-xs uppercase tracking-wide text-ink/60">Renk</p>
              <div className="mt-2 flex gap-2">
                {colors.map((c) => (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    className={`border px-4 py-2 text-sm ${
                      color === c ? "border-ink bg-ink text-paper" : "border-line"
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
          )}

          {sizes.length > 0 && sizes.some(Boolean) && (
            <div>
              <p className="text-xs uppercase tracking-wide text-ink/60">Beden</p>
              <div className="mt-2 flex gap-2">
                {sizes.map((s) => (
                  <button
                    key={s}
                    onClick={() => setSize(s)}
                    className={`border px-4 py-2 text-sm ${
                      size === s ? "border-ink bg-ink text-paper" : "border-line"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {!outOfStock && selected.stock <= LOW_STOCK_THRESHOLD && (
            <p className="text-sm text-accent">Son {selected.stock} adet</p>
          )}

          <button
            onClick={handleAdd}
            disabled={outOfStock}
            className="w-full bg-ink py-4 text-sm uppercase tracking-widest2 text-paper transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
          >
            {outOfStock ? "Stokta Yok" : added ? "Sepete Eklendi ✓" : `Sepete Ekle · ${formatPrice(selectedPriceCents)}`}
          </button>

          {outOfStock && selected && <StockAlertForm variantId={selected.id} />}

          {added && (
            <button
              onClick={() => router.push("/sepet")}
              className="w-full border border-ink py-3 text-sm uppercase tracking-wide hover:bg-ink hover:text-paper"
            >
              Sepete Git
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
