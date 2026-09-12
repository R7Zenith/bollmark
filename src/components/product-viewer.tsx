"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Heart, Minus, Plus, Truck, RotateCcw, ShieldCheck, CreditCard } from "lucide-react";
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
// Urun sayfasi alt bilgi rozetleri (kargo/iade/guvenli odeme/musteri
// destegi) - Shopify "Release" temasindaki 2x2 guven rozeti grid'ine
// karsilik gelir, tamamen statik/bilgilendirici.
const TRUST_BADGES = [
  { icon: Truck, label: "Hızlı Kargo", detail: "1-3 iş günü içinde teslim" },
  { icon: RotateCcw, label: "Kolay İade", detail: "14 gün içinde ücretsiz iade" },
  { icon: ShieldCheck, label: "Güvenli Ödeme", detail: "256-bit SSL ile korumalı" },
  { icon: CreditCard, label: "Taksit İmkanı", detail: "Kredi kartına taksit seçeneği" }
];

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
          className="shrink-0 rounded-full border border-ink px-4 py-2.5 text-sm uppercase tracking-wide hover:bg-ink hover:text-cream disabled:opacity-40"
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
  const [quantity, setQuantity] = useState(1);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);

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
      quantity
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 1800);
  };

  const handleBuyNow = () => {
    if (!selected || outOfStock) return;
    handleAdd();
    router.push("/odeme");
  };

  // Release'de galeri/bilgi paneli orani %56/%44 (1595px konteynerde 901px
  // galeri olculdu - bkz. RELEASE_TEMA_BIREBIR_UYUM_PLANI.md 3). fr birimi
  // aradaki bosluk dusuldukten sonra kalani 56:44 boler, yani oran birebir.
  return (
    <div className="grid gap-12 md:grid-cols-[56fr_44fr]">
      <div className="grid grid-cols-2 gap-4">
        {galleryImages.map((img, i) => (
          <div key={`${img.url}-${i}`} className="relative aspect-[3/4] overflow-hidden bg-line">
            <Image src={img.url} alt={img.alt} fill className="object-cover" />
          </div>
        ))}
      </div>

      <div className="md:sticky md:top-24 md:h-fit">
        {(categoryName || brandName) && (
          <p className="text-xs uppercase tracking-widest2 text-clay">
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
        {/* Release'de rozetler (LAST FEW / SALE gibi) fiyatin USTUNDE, kucuk
            dolgu etiketler halinde yan yana durur (bkz. 3) - indirim rozeti
            eskiden fiyatin yaninda, "Son N adet" ise beden seciminin altinda
            ayri bir satirdi, ikisi de buraya tasindi. */}
        {(automaticDiscount || (!outOfStock && selected.stock <= LOW_STOCK_THRESHOLD)) && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {automaticDiscount && (
              <span className="bg-sale px-2 py-1 text-[10px] font-medium uppercase tracking-[1.4px] text-cream">
                %{automaticDiscount.percent} İndirim
              </span>
            )}
            {!outOfStock && selected.stock <= LOW_STOCK_THRESHOLD && (
              <span className="bg-ink px-2 py-1 text-[10px] font-medium uppercase tracking-[1.4px] text-cream">
                Son {selected.stock} Adet
              </span>
            )}
          </div>
        )}
        <div className="mt-4 flex items-center gap-3">
          {automaticDiscount ? (
            <>
              <span className="text-xl font-medium text-sale">
                {formatPrice(Math.round((selectedPriceCents * (100 - automaticDiscount.percent)) / 100))}
              </span>
              <span className="text-ink/40 line-through">{formatPrice(selectedPriceCents)}</span>
            </>
          ) : (
            <>
              <span className={`text-xl ${compareAtCents && compareAtCents > selectedPriceCents ? "font-medium text-sale" : ""}`}>
                {formatPrice(selectedPriceCents)}
              </span>
              {compareAtCents && compareAtCents > selectedPriceCents && (
                <span className="text-ink/40 line-through">{formatPrice(compareAtCents)}</span>
              )}
            </>
          )}
        </div>
        {bundleInfo && bundleInfo.otherProductNames.length > 0 && (
          <p className="mt-3 border border-clay/40 bg-clay/5 px-4 py-2.5 text-sm text-ink/80">
            Bu ürünü <span className="font-medium">{bundleInfo.otherProductNames.join(", ")}</span> ile birlikte al, %
            {bundleInfo.discountPercent} indirim kazan.
          </p>
        )}
        {descriptionHtml && (
          <div className="mt-6">
            <div
              className={`prose-description relative leading-relaxed text-ink/70 [&_p]:mb-3 [&_p:last-child]:mb-0 [&>strong]:mb-1 [&>strong]:mt-4 [&>strong]:block [&>strong:first-child]:mt-0 ${
                descriptionExpanded ? "" : "max-h-24 overflow-hidden"
              }`}
            >
              {/* descriptionHtml sunucuda sanitizeDescriptionHtml() ile temizleniyor
                  (bkz. urunler/[slug]/page.tsx) - burada tekrar sanitize etmeye gerek yok. */}
              {/* eslint-disable-next-line react/no-danger */}
              <div dangerouslySetInnerHTML={{ __html: descriptionHtml }} />
              {!descriptionExpanded && (
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-cream to-transparent" />
              )}
            </div>
            <button
              type="button"
              onClick={() => setDescriptionExpanded((v) => !v)}
              className="mt-2 text-xs font-medium uppercase tracking-wide text-ink underline underline-offset-4"
            >
              {descriptionExpanded ? "Daha Az Göster" : "Devamını Oku"}
            </button>
          </div>
        )}

        {(material || origin || careInstructions) && (
          <details className="mt-6 border-t border-line pt-6 text-sm text-ink/70" open>
            <summary className="cursor-pointer text-xs uppercase tracking-wide text-ink/60 underline underline-offset-4">
              Ürün Detayları
            </summary>
            <div className="mt-3 space-y-1">
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
          </details>
        )}

        {sizeGuide && (
          <details className="mt-3 border-t border-line pt-6">
            <summary className="cursor-pointer text-xs uppercase tracking-wide text-ink/60 underline underline-offset-4">
              Beden Tablosu
            </summary>
            <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-ink/70">{sizeGuide}</p>
          </details>
        )}

        <div className="mt-8 space-y-6">
          {colors.length > 0 && colors.some(Boolean) && (
            <div>
              <p className="text-xs uppercase tracking-wide text-ink/60">Renk</p>
              {/* Beden kutucuklarindaki keskin kose/ince cerceve diline
                  cekildi (bkz. Adim 3) - eskiden py-2/text-sm ile beden
                  kutucuklarindan gozle gorulur bicimde daha iri/yuvarlak
                  duruyordu, iki secim grubu ayni sayfada farkli dillerde
                  gorunuyordu. Renk isimleri degisken uzunlukta oldugu icin
                  (bkz. beden kutucuklarindaki ayni gerekce) genislik sabit
                  degil, min-w-[28px] + px-3 ile yatayda buyuyor. */}
              <div className="mt-2 flex flex-wrap gap-2">
                {colors.map((c) => (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    className={`flex h-7 min-w-[28px] items-center justify-center rounded-none border border-ink px-3 text-[11px] uppercase leading-none tracking-wide transition ${
                      color === c ? "bg-ink text-cream" : "bg-transparent text-ink hover:bg-ink/5"
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
              {/* Release'de beden kutucuklari 28x28px KARE, 1px duz siyah
                  cerceve, kose yariçapi 0 (bkz. 3) - hap/pill degil. Bollmark'ta
                  "Standart"/"One Size" gibi uzun etiketler de olabildigi icin
                  genislik 28px'e sabitlenmedi, minimum 28px: kisa bedenler
                  (S/M/38) birebir kare kalir, uzun etiket sigmazsa yatayda
                  buyur - metni kirpmak yerine. */}
              <div className="mt-2 flex flex-wrap gap-2">
                {sizes.map((s) => (
                  <button
                    key={s}
                    onClick={() => setSize(s)}
                    className={`flex h-7 min-w-[28px] items-center justify-center rounded-none border border-ink px-1 text-[11px] leading-none transition ${
                      size === s ? "bg-ink text-cream" : "bg-transparent text-ink hover:bg-ink/5"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {!outOfStock && (
            <div className="flex items-center gap-1 rounded-full border border-line px-1 py-1 w-fit">
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                disabled={quantity <= 1}
                aria-label="Adedi azalt"
                className="flex h-8 w-8 items-center justify-center rounded-full transition hover:bg-line disabled:opacity-30"
              >
                <Minus size={14} />
              </button>
              <span className="w-8 text-center text-sm">{quantity}</span>
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.min(selected?.stock ?? 1, q + 1))}
                disabled={quantity >= (selected?.stock ?? 1)}
                aria-label="Adedi artır"
                className="flex h-8 w-8 items-center justify-center rounded-full transition hover:bg-line disabled:opacity-30"
              >
                <Plus size={14} />
              </button>
            </div>
          )}

          {/* Release olcumleri (bkz. 3): her iki buton da 46px yuksekliginde ve
              50px kose yariçapli (tam hap), yazi ~10px BUYUK HARF + harf
              arali. "Sepete Ekle" siyah dolgu, "Hemen Al" dolgusuz (seffaf +
              siyah cerceve). */}
          <div className="flex gap-3">
            <button
              onClick={handleAdd}
              disabled={outOfStock}
              className="h-[46px] flex-1 rounded-[50px] bg-ink text-[10px] uppercase tracking-[1.4px] text-cream transition hover:bg-clay disabled:cursor-not-allowed disabled:opacity-40"
            >
              {outOfStock ? "Stokta Yok" : added ? "Sepete Eklendi ✓" : "Sepete Ekle"}
            </button>
            {!outOfStock && (
              <button
                onClick={handleBuyNow}
                className="h-[46px] flex-1 rounded-[50px] border border-ink bg-transparent text-[10px] uppercase tracking-[1.4px] text-ink transition hover:bg-ink hover:text-cream"
              >
                Hemen Al
              </button>
            )}
          </div>

          {outOfStock && selected && <StockAlertForm variantId={selected.id} />}

          {added && (
            <button
              onClick={() => router.push("/sepet")}
              className="w-full rounded-full border border-ink py-3 text-sm uppercase tracking-wide hover:bg-ink hover:text-cream"
            >
              Sepete Git
            </button>
          )}

          {/* Release'de guven rozetleri 2x2 bir grid degil, tek satir
              yuksekliginde dikey bir "ticker": mesajlar sirayla yukari kayarak
              degisiyor (bkz. 3 - animasyonun olculen keyframe'leri
              globals.css'teki .trust-ticker). Ust cizgi/dolgu disarida:
              .trust-ticker'in kendisi 22px'lik pencere oldugu icin uzerine
              padding verilirse pencere bozulur. */}
          <div className="border-t border-line pt-6">
            <div className="trust-ticker">
              <div className="trust-ticker__rows">
                {/* Son eleman ilk mesajin kopyasi - dongu basa donerken
                    sicrama gorunmesin diye (bkz. globals.css .trust-ticker). */}
                {[...TRUST_BADGES, TRUST_BADGES[0]].map(({ icon: Icon, label, detail }, i) => {
                  const isClone = i === TRUST_BADGES.length;
                  return (
                    <div
                      key={`${label}-${i}`}
                      aria-hidden={isClone}
                      className={`trust-ticker__row flex items-center gap-2.5 ${
                        isClone ? "trust-ticker__row--clone" : ""
                      }`}
                    >
                      <Icon size={16} className="shrink-0 text-ink/60" />
                      <p className="min-w-0 truncate text-xs text-ink/60">
                        <span className="font-medium uppercase tracking-wide text-ink">{label}</span>
                        <span className="mx-1.5">·</span>
                        {detail}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
