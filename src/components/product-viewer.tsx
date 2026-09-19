"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import useEmblaCarousel from "embla-carousel-react";
import { useRouter } from "next/navigation";
import { Heart, Minus, Plus, Truck, RotateCcw, ShieldCheck, Check, ZoomIn, Clock, ChevronRight } from "lucide-react";
import Lightbox from "yet-another-react-lightbox";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import "yet-another-react-lightbox/styles.css";
import { useCart } from "@/lib/cart";
import { useWishlist } from "@/lib/wishlist";
import { formatPrice } from "@/lib/format";
import { effectivePrice } from "@/lib/variant";
import { resolveProductDisplayPrice, type AutomaticPercentCampaign } from "@/lib/coupons";
import { ProductBadge } from "@/components/product-badge";
import { InfoDrawer } from "@/components/info-drawer";
import { SizeGuideModal } from "@/components/size-guide-modal";

// Bu esikten dusuk stok "Son N adet" uyarisi gosterir - e-posta gerektirmeyen
// salt UI bir isaret. Ileride StoreSettings'e tasinabilir (Faz A'ya dahil degil).
const LOW_STOCK_THRESHOLD = 3;

// release-main.myshopify.com/products/top-8 canli DOM'unda urun bilgisi
// altinda IKI AYRI eleman var, biz eskiden bunlari tek bir 4-mesajli
// ticker'da karistirmistik:
// 1) `.product__text--body-animated` x2: her biri onay isaretli, 2 kisa
//    mesaj arasinda gecis yapan tek satirlik bir "ticker" (bkz.
//    globals.css .trust-ticker - keyframe'ler dogrudan Release'in
//    `@keyframes textSwap`'inden alindi: 5.9s, -100%/-200%). Iki ticker
//    ayni 2 mesaji FARKLI sirada gosteriyor (biri "kargo" ile, digeri
//    "odeme" ile basliyor) - kucuk bir gorsel kayma/stagger hissi icin.
const TICKER_MESSAGES = ["1500TL ve Üzerine Ücretsiz Kargo ve Teslimat", "Güvenli Online Ödeme"];
// 2) `.product__content-grid`: kenarlikli, kose yuvarlatilmis (1.4rem) 3
//    kutudan olusan STATIK bir izgara (ikon ustte, etiket altta) - sadece
//    orta+genis ekranlarda gorunur (`small-hide`).
const STATIC_TRUST_ITEMS = [
  { icon: Truck, label: "Hızlı Kargo" },
  { icon: RotateCcw, label: "Ücretsiz İade" },
  { icon: ShieldCheck, label: "%100 Güvenli Ödeme" }
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
  breadcrumb,
  descriptionHtml,
  material,
  origin,
  careInstructions,
  priceCents,
  compareAtCents,
  categoryId,
  brandId,
  gender,
  fallbackImages,
  colorGalleries,
  variants,
  bundleInfo,
  automaticCampaigns,
  isNew,
  initialColor
}: {
  productId: string;
  productName: string;
  categoryName: string | null;
  brandName: string | null;
  // Mobilde fotografin ustunde gosterilen "Anasayfa / Kadin / Elbise" gibi
  // gezinme yolu (bkz. urunler/[slug]/page.tsx) - Koton'un urun sayfasindaki
  // konum bildirimiyle birebir ayni yerde.
  breadcrumb?: { label: string; href: string }[];
  descriptionHtml: string;
  material: string | null;
  origin: string | null;
  careInstructions: string | null;
  priceCents: number;
  compareAtCents: number | null;
  categoryId: string | null;
  brandId: string | null;
  gender: string | null;
  fallbackImages: { url: string; alt: string }[];
  colorGalleries: Record<string, string[]>;
  variants: Variant[];
  bundleInfo?: { discountPercent: number; otherProductNames: string[] } | null;
  // Aktif, kodsuz PERCENT kampanyalar (bkz. lib/coupons.ts
  // getActiveAutomaticPercentCampaigns) - secili varyantin fiyati her
  // degistiginde resolveProductDisplayPrice ile yeniden eslestirilir. Bu da
  // sadece bilgilendirici bir rozet/gorunur fiyat icindir; sepetteki gercek
  // indirim yine de siparis olusturulurken resolveBestDiscount ile hesaplanir.
  automaticCampaigns?: AutomaticPercentCampaign[];
  // Urun NEW_PRODUCT_DAYS icinde eklenmisse "Yeni" rozeti icin (bkz.
  // lib/catalog.ts isNewProduct).
  isNew?: boolean;
  // Katalogdan "?renk=..." ile gelindiginde o rengin onceden secili acilmasi
  // icin (bkz. urunler/[slug]/page.tsx, lib/catalog.ts getCatalogEntries).
  // Gecersiz/eslesmeyen bir deger gelirse sessizce ilk renge dusulur.
  initialColor?: string;
}) {
  const { addLine, openDrawer } = useCart();
  const { ids: wishlistIds, isAuthenticated, toggle: toggleWishlist } = useWishlist();
  const router = useRouter();
  const isWishlisted = wishlistIds.has(productId);

  const sizes = orderedOptionValues(variants, (v) => v.size, (v) => v.sizePosition);
  const colors = orderedOptionValues(variants, (v) => v.color, (v) => v.colorPosition);
  const startColor = initialColor && colors.includes(initialColor) ? initialColor : (colors[0] ?? "");
  const [color, setColor] = useState(startColor);
  // Beden, musteri bilincli secene kadar bos (null) - yanlis beden siparisi ve
  // iade riskini azaltmak icin. Istisna: bedensiz (sizes bos) veya tek bedenli
  // (Standart/Tek Ebat) urunlerde secim yapilacak bir sey olmadigi icin o deger
  // otomatik secilir, yoksa musteri sepete hic ekleyemez.
  const [size, setSize] = useState<string | null>(() =>
    sizes.length === 0 ? "" : sizes.length === 1 ? sizes[0] : null
  );
  const [sizeWarning, setSizeWarning] = useState(false);
  const [sizeHighlight, setSizeHighlight] = useState(false);
  const [added, setAdded] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const [iadeDrawerOpen, setIadeDrawerOpen] = useState(false);
  const [bakimDrawerOpen, setBakimDrawerOpen] = useState(false);
  const [sizeGuideModalOpen, setSizeGuideModalOpen] = useState(false);

  // Release'de urun gorselleri PhotoSwipe ile tiklaninca tam ekran bir
  // lightbox'ta aciliyor (zoom="click", bkz. product-media-gallery.js).
  // Bizde `yet-another-react-lightbox` + Zoom eklentisi kullaniliyor (bkz.
  // MOBIL_KATALOG..._PLANI.md 4d) - pinch-zoom, zoomlu halde parmakla pan
  // (gezinme) VE zoomlu haldeyken bile sonraki/onceki gorsele swipe hepsi
  // kutuphanenin kendi mantigiyla geliyor; elle yazilmis sabit 2x zoom +
  // tiklanan noktaya transform-origin kodu bunun icin yetersizdi.
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [activeImage, setActiveImage] = useState(0);
  // Mobil ana gorsel icin Embla Carousel (bkz. MOBIL_KATALOG..._PLANI.md 4c)
  // - elle yazilmis touchstart/touchmove/touchend swipe'i degistirdi:
  // kullanici gercek cihazda elle yazilan swipe'in "bazen bug oluyor,
  // kasiyor" hissi verdigini bildirmisti. Embla headless (kendi CSS'ini
  // dayatmiyor, mevcut Tailwind gorunumu korundu). Kucuk resim seridi
  // Koton'un tasarimina uyum icin kaldirildi (bkz. asagida `activeImage`
  // ile senkron ilerleme cizgileri) - artik tek Embla instance'i yeterli.
  const [emblaMainRef, emblaMainApi] = useEmblaCarousel({ loop: true });

  // release-main.myshopify.com/products/top-8 canli DOM'unda "Size guide"
  // linki BEDEN etiketinin hemen yaninda duruyor (`group "Size XS Size
  // guide"`), Bollmark'ta bu kisayol genel/urune bagli olmayan
  // SizeGuideModal'i acar (bkz. asagida sizeGuideModalOpen).

  const selected = size === null ? undefined : variants.find((v) => v.size === size && v.color === color);
  const needsSize = size === null;
  const selectedPriceCents = selected ? effectivePrice({ priceCents }, selected) : priceCents;

  // Basligin ustundeki "Son X Adet" rozeti icin katalogla ayni mantik (bkz.
  // lib/catalog.ts LOW_STOCK_THRESHOLD): tek bir beden degil, secili RENGIN
  // TUM bedenlerdeki toplam stogu esigin altindaysa gosterilir - butonlarin
  // altindaki "Son N adet kaldi" satiri (asagida, selected.stock ile) ise
  // sadece secili bedeni yansitir, bu ikisi kasitli olarak ayri tutuluyor.
  const colorVariants = variants.filter((v) => v.color === color);
  const colorStock = colorVariants.reduce((sum, v) => sum + Math.max(v.stock, 0), 0);
  const colorOutOfStock = colorVariants.length > 0 && colorVariants.every((v) => v.stock <= 0);
  const lowStockBadgeCount = !colorOutOfStock && colorStock < LOW_STOCK_THRESHOLD ? colorStock : null;

  // Beden secilmedigi surece "Stokta Yok" gosterilmez (buton normal kalir,
  // tiklayinca uyari cikar) - ama secili rengin tamami stoksuzsa mevcut
  // "Stokta Yok" akisi bedenden bagimsiz korunur.
  const outOfStock = colorOutOfStock || (!needsSize && (!selected || selected.stock <= 0));

  const isSizeOutOfStock = (s: string) =>
    !variants.some((v) => v.size === s && v.color === color && v.stock > 0);

  const isColorOutOfStock = (c: string) =>
    !variants.some((v) => v.color === c && v.stock > 0);

  // Manuel indirim (compareAtCents) ile kategori/marka bazli otomatik
  // kampanyadan hangisi musteriye daha avantajliysa onu yansitir - ikisi asla
  // ust uste uygulanmaz (bkz. lib/coupons.ts resolveProductDisplayPrice,
  // product-card.tsx'in de kullandigi ayni fonksiyon).
  const priceResolution = resolveProductDisplayPrice(automaticCampaigns ?? [], {
    priceCents: selectedPriceCents,
    compareAtCents,
    categoryId,
    brandId,
    gender
  });

  const selectedColorValueId =
    variants.find((v) => v.color === color)?.colorValueId ?? null;

  const galleryImages = useMemo(() => {
    const urls = selectedColorValueId ? colorGalleries[selectedColorValueId] : undefined;
    if (urls && urls.length > 0) return urls.map((url) => ({ url, alt: productName }));
    if (fallbackImages.length > 0) return fallbackImages;
    return [{ url: "https://images.unsplash.com/photo-1445205170230-053b83016050?w=1200", alt: productName }];
  }, [selectedColorValueId, colorGalleries, fallbackImages, productName]);

  // Renk degisince mobil galerinin ana gorseli, yeni set'in disinda kalan
  // eski bir index'te takili kalmasin diye basa donuyor.
  useEffect(() => {
    setActiveImage(0);
    emblaMainApi?.scrollTo(0, true);
  }, [galleryImages, emblaMainApi]);

  // Ilerleme cizgisine (veya lightbox'a) tiklaninca ana carousel'i o
  // index'e kaydirir - eskiden kucuk resim seridine tiklamak icindi,
  // Koton'daki gibi ilerleme cizgilerine gecildikten sonra ayni islevi
  // koruyor.
  const onThumbClick = useCallback(
    (index: number) => {
      emblaMainApi?.scrollTo(index);
    },
    [emblaMainApi]
  );

  // Ana carousel kaydirilinca (swipe veya ilerleme cizgisine tiklayarak)
  // aktif index'i gunceller.
  useEffect(() => {
    if (!emblaMainApi) return;
    const onSelect = () => {
      setActiveImage(emblaMainApi.selectedScrollSnap());
    };
    onSelect();
    emblaMainApi.on("select", onSelect).on("reInit", onSelect);
    return () => {
      emblaMainApi.off("select", onSelect).off("reInit", onSelect);
    };
  }, [emblaMainApi]);

  const selectSize = (s: string) => {
    setSize(s);
    setSizeWarning(false);
    setSizeHighlight(false);
  };

  // Renk degisince secili beden yeni renkte stokta varsa korunur, yoksa
  // sifirlanir - sessizce baska bir bedene atlamasin.
  const selectColor = (c: string) => {
    setColor(c);
    if (size && sizes.length > 1 && !variants.some((v) => v.size === size && v.color === c && v.stock > 0)) {
      setSize(null);
    }
  };

  // Beden secilmeden ekleme/satin alma denenirse uyari gosterir ve beden
  // kutucuklarini kisa sure vurgular; true doner = islem durdurulmali.
  const blockIfSizeMissing = () => {
    if (!needsSize) return false;
    setSizeWarning(true);
    setSizeHighlight(true);
    setTimeout(() => setSizeHighlight(false), 1500);
    return true;
  };

  const addToCart = () => {
    if (!selected || outOfStock) return;
    addLine({
      productId,
      variantId: selected.id,
      name: productName,
      size: selected.size,
      color,
      priceCents: selectedPriceCents,
      compareAtCents: compareAtCents && compareAtCents > selectedPriceCents ? compareAtCents : null,
      image: galleryImages[0].url,
      quantity
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 1800);
  };

  const handleAdd = () => {
    if (blockIfSizeMissing()) return;
    if (!selected || outOfStock) return;
    addToCart();
    openDrawer();
  };

  const handleBuyNow = () => {
    if (blockIfSizeMissing()) return;
    if (!selected || outOfStock) return;
    addToCart();
    router.push("/odeme");
  };

  // Embla, gercek bir surukleme sonrasi tarayicinin sentezledigi "click"
  // olayini kendi ic mantigiyla (yakalama asamasinda stopPropagation)
  // bastiriyor - onceki elle yazilmis "wasSwipe" ref hilesine gerek kalmadi,
  // buraya sadece normal bir tiklama isleyicisi yeterli.
  const handleSlideClick = (index: number) => {
    setLightboxIndex(index);
  };

  // release-main.myshopify.com/products/top-8'de her genislikte SAYFA
  // YENIDEN YUKLENEREK olculdu (resize yetmiyor, tema grid genisliklerini
  // JS ile sayfa yuklenirken hesapliyor): bilgi paneli ~586-590px civarinda
  // sabit kaliyor (1600px'te 586px, 1920px'te 590px), ekstra genislik
  // TAMAMEN galeriye gidiyor (1600px'te 895px, 1920px'te 1211px). Yuzdesel
  // bolunme (60fr/40fr) bunu yanlis modelliyordu - genis ekranlarda bilgi
  // paneli sisip galeriyi daraltiyordu (1920px'te 720px/1081px).
  return (
    <>
    <div className="grid gap-x-8 gap-y-4 md:grid-cols-[1fr_minmax(320px,590px)] md:gap-y-12">
      {/* Release'in `.main-product__media--grid`'inde kutular arasi bosluk
          `gallery-gap/2` = 0.8rem (~13px, bizde eskiden 16px'ti) - buna
          cekildi. aspect-[3/4] + object-cover korunuyor: Release'de
          --product-media-object-fit: contain ile gorsel kirpilmiyor ama
          bizim urun fotograflarimiz tutarli bir kesim/oranla cekilmedigi
          icin contain'e gecmek bos/kucuk gorunen kutulara yol acardi -
          object-cover kutuyu her zaman doldurup "buyuk" hissi koruyor. */}
      {/* Mobilde Release tek buyuk ana gorsel + altinda kucuk kare
          kucukresim seridi kullaniyor - masaustundeki gibi TUM gorselleri
          alt alta 2 sutuna dizmiyor (release-main.myshopify.com/products/
          top-8, 390px'te Playwright ile ekran goruntusu alinarak dogrulandi,
          12 Eylul 2026). Eskiden mobilde de masaustundeki 2 sutunlu grid
          aynen kullanilyordu - bu, "desktop tasarimini kuculterek mobil
          yapma" hatasiydi, burada ayri bir mobil duzen olarak ayristirildi. */}
      <div className="min-w-0 md:hidden">
        {/* Koton'un urun sayfasinda fotografin UZERINDE, sayfa kenar
            bosluklarindan bagimsiz kucuk bir gezinme yolu var ("Anasayfa /
            Kadin / Elbise" gibi) - konum bilgisi 17 Eylul 2026'da
            koton.com/.../4212827 mobil gorunumunde (390px, Playwright)
            olculdu. Sayfa konteynerinin px-4'u burada da gecerli. */}
        {breadcrumb && breadcrumb.length > 0 && (
          <nav aria-label="Konum" className="mb-3 flex flex-wrap items-center gap-x-1 text-[11px] text-ink/50">
            {breadcrumb.map((item, i) => (
              <span key={item.href} className="flex items-center gap-x-1">
                {i > 0 && <span className="text-ink/30">/</span>}
                <Link href={item.href} className="hover:text-ink/80">
                  {item.label}
                </Link>
              </span>
            ))}
          </nav>
        )}
        {/* Fotograf Koton'da sayfanin kenar bosluklarini tamamen yok sayip
            tam viewport genisliginde goruniyor (ayni olcumde dogrulandi) -
            konteynerin px-4'unu (16px) -mx-4 ile iptal ediyoruz, sadece bu
            blok icin. Embla ana carousel: `overflow-hidden` sarmalayici
            Embla'nin "viewport" referansini tutuyor, icindeki `flex` satir
            gercek slaytlari barindiriyor - momentum/surukleme/snap fizigi
            tamamen Embla tarafindan yonetiliyor (bkz. yukaridaki
            emblaMainApi state'i). */}
        <div className="relative -mx-4 overflow-hidden" ref={emblaMainRef}>
          <div className="flex touch-pan-y">
            {galleryImages.map((img, i) => (
              <div key={`${img.url}-${i}`} className="relative min-w-0 flex-[0_0_100%]">
                <button
                  type="button"
                  onClick={() => handleSlideClick(i)}
                  className="relative block aspect-[3/4] w-full cursor-zoom-in overflow-hidden bg-line"
                >
                  <Image src={img.url} alt={img.alt} fill sizes="100vw" className="object-cover" priority={i === 0} />
                </button>
              </div>
            ))}
          </div>
          {/* Koton'un kucuk resim seridi yerine fotografin ALT KENARINA
              bindirilmis ince, yari saydam beyaz cizgiler kullaniyoruz -
              hangi sirada oldugumuzu gosteren, aktif olan tam beyaz/opak
              geri kalani ~%40 opak (Instagram hikaye ilerleme cubugu
              deseniyle ayni mantik). Onceki kare kucukresim seridinin
              yerini aldi - Koton'da kucuk resim yok, sadece bu cizgiler var. */}
          {galleryImages.length > 1 && (
            <div className="pointer-events-none absolute inset-x-3 bottom-3 flex gap-1">
              {galleryImages.map((img, i) => (
                <button
                  key={`${img.url}-${i}`}
                  type="button"
                  onClick={() => onThumbClick(i)}
                  aria-label={`${i + 1}. fotoğrafı göster`}
                  aria-current={i === activeImage}
                  className={`pointer-events-auto h-[2px] flex-1 rounded-full transition-colors duration-300 ${
                    i === activeImage ? "bg-white" : "bg-white/40"
                  }`}
                />
              ))}
            </div>
          )}
          {/* Favori kalbi Koton'da fotografin sag ust kosesine bindirilmis -
              masaustundeki basligin yanindaki kalp butonuyla ayni
              toggleWishlist islevini paylasiyor, sadece mobilde konumu
              degisiyor (bkz. asagida bilgi panelindeki `hidden md:flex`
              kalp). */}
          <button
            type="button"
            onClick={() => toggleWishlist(productId)}
            className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-cream/90 shadow"
            title={isWishlisted ? "Favorilerden çıkar" : "Favorilere ekle"}
          >
            <Heart size={17} fill={isWishlisted ? "currentColor" : "none"} />
          </button>
        </div>
      </div>

      <div className="hidden md:grid md:grid-cols-2 md:gap-[8px]">
        {galleryImages.map((img, i) => (
          <button
            key={`${img.url}-${i}`}
            type="button"
            onClick={() => setLightboxIndex(i)}
            className="group relative aspect-[3/4] cursor-zoom-in overflow-hidden bg-line"
          >
            <Image src={img.url} alt={img.alt} fill className="object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
            <span className="pointer-events-none absolute bottom-3 right-3 flex h-9 w-9 items-center justify-center rounded-full bg-cream/90 opacity-0 shadow transition-opacity duration-200 group-hover:opacity-100">
              <ZoomIn size={16} className="text-ink" />
            </span>
          </button>
        ))}
      </div>

      <div className="md:sticky md:top-24 md:h-fit">
        {/* Release'in canli urun sayfasinda (release-main.myshopify.com/
            products/top-13, Playwright ile DOM+computed style olculdu, 17
            Eylul 2026) `.product__badges` sutunun EN BASINDA duruyor - kategori/
            marka satirindan (bizde asagida) bile once, hicbir eleman ustunde
            degil. Ayni sayfada 3 rozet turu bulundu: indirim (kirmizi
            #EF2D2D/beyaz, --color-badge-discount-background), ve tag'e bagli
            "last few"/"New"/"sale" (PDP baglaminda koyu gri #5E5A59/beyaz -
            katalog kartinda ayni rozetler beyaz zeminli, Release'in kendisinde
            de boyle - bkz. product-badge.tsx). Font hepsinde ayni: Poppins
            10px/500/uppercase, letter-spacing 1.4px, padding 6px 8px,
            border-radius 4px. "last few"/"New"/"sale" Release'de otomatik
            degil, elle "badge:..." tag'iyle yonetiliyor (gercek urun verisiyle
            dogrulandi) - Bollmark'ta karsiligi olmadigi icin sadece "Yeni"
            (createdAt bazli, bkz. lib/catalog.ts isNewProduct) ve "Son X Adet"
            (gercek stok) kullaniliyor. */}
        {(priceResolution.badgePercent || isNew || lowStockBadgeCount != null) && (
          <div className="mb-2 hidden flex-row flex-wrap items-start gap-2 md:flex">
            {priceResolution.badgePercent && (
              <ProductBadge variant="discount" size="lg">
                %{priceResolution.badgePercent} İndirim
              </ProductBadge>
            )}
            {isNew && <ProductBadge variant="new" size="lg">Yeni</ProductBadge>}
            {lowStockBadgeCount != null && (
              <ProductBadge variant="low-stock" size="lg">
                Son {lowStockBadgeCount} Adet
              </ProductBadge>
            )}
          </div>
        )}
        {/* Mobilde bu satir yerine fotografin ustundeki breadcrumb (Anasayfa
            / Kadin / Elbise) gosteriliyor - Koton'da urun basliginin
            ustunde ayrica kategori/marka satiri yok, tek konum bilgisi
            fotografin uzerindeki gezinme yolu. */}
        {(categoryName || brandName) && (
          <p className="hidden text-xs uppercase tracking-widest2 text-clay md:block">
            {[categoryName, brandName].filter(Boolean).join(" · ")}
          </p>
        )}
        <div className="mt-2 flex items-start justify-center gap-3 text-center md:justify-between md:text-left">
          {/* release-main.myshopify.com/products/top-8 urun basligi `h6`
              sinifini kullanir: --font-size-static-h6: 2.1rem,
              --font-heading-letter-spacing: -0.04em (bkz. canli tema CSS
              degiskenleri, 13 Eylul 2026 olculdu) - eskiden genel text-4xl
              (2.25rem, sitenin geneldeki acik/ferah baslik dilinde) idi,
              bu sayfaya ozel birebir olcuye cekildi. Koton'un mobil urun
              sayfasinda baslik fotografin altinda TAM ORTALI - kalp butonu
              orada fotografin uzerine tasindi (bkz. yukarida mobil galeri
              bloğu), bu yuzden mobilde bu satirda artik kalp yok. */}
          <h1 className="font-display text-[21px] leading-[1.15] tracking-[-0.84px]">{productName}</h1>
          <button
            type="button"
            onClick={() => toggleWishlist(productId)}
            className="mt-1 hidden h-10 w-10 shrink-0 items-center justify-center rounded-full border border-line hover:border-ink md:flex"
            title={isWishlisted ? "Favorilerden çıkar" : "Favorilere ekle"}
          >
            <Heart size={18} fill={isWishlisted ? "currentColor" : "none"} />
          </button>
        </div>
        {!isAuthenticated && (
          <p className="mt-1 text-center text-xs text-ink/50 md:text-left">
            Favorileriniz bu cihazda saklanıyor, kalıcı olması için giriş yapın.
          </p>
        )}
        {/* Mobilde rozetler masaustundeki gibi basligin UZERINDE degil, urun
            ismi ile fiyat arasinda, yatay ve ortali gosteriliyor (kullanicinin
            acik istegiyle) - masaustu blogu yukarida `md:flex` ile sadece
            orada gorunuyor, bu blok da `md:hidden` ile sadece mobilde. */}
        {(priceResolution.badgePercent || isNew || lowStockBadgeCount != null) && (
          <div className="mt-2 flex flex-row flex-wrap items-center justify-center gap-2 md:hidden">
            {priceResolution.badgePercent && (
              <ProductBadge variant="discount" size="lg">
                %{priceResolution.badgePercent} İndirim
              </ProductBadge>
            )}
            {isNew && <ProductBadge variant="new" size="lg">Yeni</ProductBadge>}
            {lowStockBadgeCount != null && (
              <ProductBadge variant="low-stock" size="lg">
                Son {lowStockBadgeCount} Adet
              </ProductBadge>
            )}
          </div>
        )}
        {/* Fiyat: Release'de `.product__price .price{font-size:
            var(--font-size-static-md)}` = 1.4rem - eskiden genel text-xl
            (1.25rem) kullaniliyordu. Koton'un mobil urun sayfasinda fiyat
            basligin altinda, tam ortali ve kalin puntolu (bkz. urun-detay-
            390.png) - eskiden masaustuyle ayni ince/sola yasli goruntuydu. */}
        {/* Release'de "Taxes included." notu fiyatla AYNI SATIRDA, hemen
            yaninda duruyor - masaustunde bu korunuyor. Koton'un mobil urun
            sayfasinda ise "KDV dahildir" fiyatin ALTINDA, ayri bir satirda
            ve ikisi de tam ortali - mobilde bu yuzden dikey (flex-col)
            diziliyor, md'de tekrar ayni satira donuyor. */}
        <div className="mt-2 flex flex-col items-center gap-y-0.5 md:mt-4 md:flex-row md:flex-wrap md:items-baseline md:justify-start md:gap-x-3 md:gap-y-1">
          <div className="flex flex-wrap items-baseline justify-center gap-x-3 md:contents">
            {priceResolution.originalPriceCents != null ? (
              <>
                <span className="text-[16px] font-semibold text-sale md:text-[14px] md:font-medium">
                  {formatPrice(priceResolution.finalPriceCents)}
                </span>
                <span className="text-ink/40 line-through">{formatPrice(priceResolution.originalPriceCents)}</span>
              </>
            ) : (
              <span className="text-[16px] font-semibold md:text-[14px] md:font-normal">
                {formatPrice(priceResolution.finalPriceCents)}
              </span>
            )}
          </div>
          <span className="text-[10px] uppercase tracking-wide text-ink/40">KDV dahildir.</span>
        </div>
        {bundleInfo && bundleInfo.otherProductNames.length > 0 && (
          <p className="mt-3 border border-clay/40 bg-clay/5 px-4 py-2.5 text-sm text-ink/80">
            Bu ürünü <span className="font-medium">{bundleInfo.otherProductNames.join(", ")}</span> ile birlikte al, %
            {bundleInfo.discountPercent} indirim kazan.
          </p>
        )}
        {(material || origin || careInstructions) && (
          <details className="mt-6 border-t border-line pt-6 text-sm text-ink/70" open>
            {/* Release'in `.accordion__button`'u: font-size 1.6rem,
                letter-spacing -0.04em, BUYUK HARF DEGIL, alti cizili degil -
                sadece hover'da altini cizen bir gecis var (bkz.
                section-accordions.css, 13 Eylul 2026). Eskiden 12px kucuk
                harf + surekli alt cizgiliydi. */}
            <summary className="cursor-pointer text-[16px] tracking-[-0.64px] text-ink underline decoration-transparent underline-offset-[5px] transition duration-300 hover:decoration-ink">
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
                {colors.map((c) => {
                  const unavailable = isColorOutOfStock(c);
                  return (
                    <button
                      key={c}
                      onClick={() => selectColor(c)}
                      className={`relative flex h-7 min-w-[28px] items-center justify-center rounded-none border border-ink px-3 text-xs uppercase leading-none tracking-[1px] transition duration-300 ${
                        color === c ? "bg-ink text-cream" : "bg-transparent text-ink hover:bg-ink/5"
                      } ${unavailable ? "opacity-40" : ""}`}
                    >
                      {c}
                      {unavailable && (
                        <span className="pointer-events-none absolute inset-0 overflow-hidden">
                          <span className="absolute left-1/2 top-1/2 h-px w-[141%] -translate-x-1/2 -translate-y-1/2 rotate-45 bg-current" />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {sizes.length > 0 && sizes.some(Boolean) && (
            <div>
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs uppercase tracking-wide text-ink/60">Beden</p>
                <button
                  type="button"
                  onClick={() => setSizeGuideModalOpen(true)}
                  className="text-xs uppercase tracking-wide text-ink underline underline-offset-4 hover:text-ink/70"
                >
                  Beden Rehberi
                </button>
              </div>
              {/* Release'de beden kutucuklari 28x28px KARE, 1px duz siyah
                  cerceve, kose yariçapi 0 (bkz. 3) - hap/pill degil. Bollmark'ta
                  "Standart"/"One Size" gibi uzun etiketler de olabildigi icin
                  genislik 28px'e sabitlenmedi, minimum 28px: kisa bedenler
                  (S/M/38) birebir kare kalir, uzun etiket sigmazsa yatayda
                  buyur - metni kirpmak yerine. */}
              <div className="mt-2 flex flex-wrap gap-2">
                {sizes.map((s) => {
                  const unavailable = isSizeOutOfStock(s);
                  return (
                    <button
                      key={s}
                      onClick={() => selectSize(s)}
                      className={`relative flex h-7 min-w-[28px] items-center justify-center rounded-none border px-1 text-xs leading-none tracking-[1px] transition duration-300 ${
                        sizeHighlight ? "border-sale" : "border-ink"
                      } ${
                        size === s ? "bg-ink text-cream" : "bg-transparent text-ink hover:bg-ink/5"
                      } ${unavailable ? "opacity-40" : ""}`}
                    >
                      {s}
                      {unavailable && (
                        <span className="pointer-events-none absolute inset-0 overflow-hidden">
                          <span className="absolute left-1/2 top-1/2 h-px w-[141%] -translate-x-1/2 -translate-y-1/2 rotate-45 bg-current" />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              {sizeWarning && needsSize && (
                <p role="alert" className="mt-2 text-xs text-sale">
                  Lütfen beden seçin
                </p>
              )}
            </div>
          )}

          {/* release-main.myshopify.com/products/top-8 canli CSS'inde
              `.product-form__buttons{display:grid;grid-template-columns:
              repeat(10,1fr)}` - adet secici 3/10 (%30), "Add to cart" 7/10
              (%70), AYNI SATIRDA yan yana (bkz. 13 Eylul 2026 olcumu).
              "Buy it now" ise bu satirin ALTINDA, tam genislikte ayri bir
              satir (Shopify'in `.shopify-payment-button`'u 10/10 span
              alip otomatik alt satira dusuyor). Eskiden adet secici kendi
              satirinda, Sepete Ekle/Hemen Al da altta %50/%50 yan yanaydi -
              ucu de degisti. */}
          <div className="grid grid-cols-10 gap-3">
            {!outOfStock && (
              <div className="col-span-3 flex h-[46px] items-center justify-between rounded-full border border-line px-1">
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  disabled={needsSize || quantity <= 1}
                  aria-label="Adedi azalt"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition duration-300 hover:bg-line disabled:opacity-30"
                >
                  <Minus size={14} />
                </button>
                <span className="text-center text-sm">{quantity}</span>
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.min(selected?.stock ?? 1, q + 1))}
                  disabled={needsSize || quantity >= (selected?.stock ?? 1)}
                  aria-label="Adedi artır"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition duration-300 hover:bg-line disabled:opacity-30"
                >
                  <Plus size={14} />
                </button>
              </div>
            )}
            {/* Release'de dolu ("filled") butonun hover'i renk degistirmez
                (mesela kahve/clay tonuna kaymaz) - arka plani SEFFAMLASIP
                metin/cerceve dolgu rengine donerek "outline"a donusur
                (bkz. base.css .button--filled, 13 Eylul 2026). */}
            <button
              onClick={handleAdd}
              disabled={outOfStock}
              className={`${outOfStock ? "col-span-10" : "col-span-7"} h-[46px] rounded-[50px] border border-ink bg-ink text-[10px] uppercase tracking-[1.4px] text-cream transition duration-300 hover:bg-transparent hover:text-ink disabled:cursor-not-allowed disabled:opacity-40`}
            >
              {outOfStock ? "Stokta Yok" : added ? "Sepete Eklendi ✓" : "Sepete Ekle"}
            </button>
          </div>

          {!outOfStock && (
            <button
              onClick={handleBuyNow}
              className="h-[46px] w-full rounded-[50px] border border-ink bg-transparent text-[10px] uppercase tracking-[1.4px] text-ink transition duration-300 hover:bg-ink hover:text-cream"
            >
              Hemen Al
            </button>
          )}

          {outOfStock && selected && <StockAlertForm variantId={selected.id} />}

          {!outOfStock && selected && selected.stock <= LOW_STOCK_THRESHOLD && (
            <p className="flex items-center gap-2 text-xs text-ink/70">
              <Clock size={14} className="shrink-0 text-ink/60" />
              Son {selected.stock} adet kaldı. Acele edin.
            </p>
          )}

          {descriptionHtml && (
            <div>
              <div
                className={`prose-description text-sm relative leading-relaxed text-ink/70 [&_p]:mb-3 [&_p:last-child]:mb-0 [&>strong]:mb-1 [&>strong]:mt-4 [&>strong]:block [&>strong:first-child]:mt-0 ${
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

          {/* Koton'un urun sayfasindaki gibi (referans: koton.com/.../4197527)
              urun aciklamasinin hemen altinda, ok isaretli uc satir - Iade ve
              Degisim / Urun Bakim Talimati InfoDrawer (cart-drawer.tsx'teki
              sagdan cekmece deseniyle) acarken, Beden Tablosu artik urune
              bagli degil - genel/tum siteye ortak SizeGuideModal'i (ortali
              modal) acar (bkz. URUN_DETAY_IADE_BAKIM_BEDEN_TABLOSU_PLANI.md
              v4). Sira: Iade ve Degisim -> Urun Bakim Talimati -> Beden
              Tablosu. */}
          <div>
            <button
              type="button"
              onClick={() => setIadeDrawerOpen(true)}
              className="flex w-full items-center justify-between border-t border-line py-4 text-[16px] tracking-[-0.64px] text-ink"
            >
              İade ve Değişim
              <ChevronRight size={18} className="text-ink/40" />
            </button>
            <button
              type="button"
              onClick={() => setBakimDrawerOpen(true)}
              className="flex w-full items-center justify-between border-t border-line py-4 text-[16px] tracking-[-0.64px] text-ink"
            >
              Ürün Bakım Talimatı
              <ChevronRight size={18} className="text-ink/40" />
            </button>
            <button
              type="button"
              onClick={() => setSizeGuideModalOpen(true)}
              className="flex w-full items-center justify-between border-t border-b border-line py-4 text-[16px] tracking-[-0.64px] text-ink"
            >
              Beden Tablosu
              <ChevronRight size={18} className="text-ink/40" />
            </button>
          </div>

          {/* release-main.myshopify.com/products/top-8'de IKI AYRI ticker
              satiri var, ikisi de ayni 2 mesaj arasinda geçiş yapiyor ama
              FARKLI sirada basliyor (kucuk bir kayma hissi icin, bkz. canli
              HTML, 13 Eylul 2026). Animasyon Release'in kendi
              `@keyframes textSwap`'i: 5.9s, -100%/-200% (globals.css
              .trust-ticker - eskiden 4 mesajli TEK bir ticker'dik, artik
              gercek yapiya cekildi). */}
          <div className="space-y-2 border-t border-line pt-6">
            {[0, 1].map((offset) => {
              const ordered = [TICKER_MESSAGES[offset % 2], TICKER_MESSAGES[(offset + 1) % 2]];
              const rows = [...ordered, ordered[0]];
              return (
                <div className="trust-ticker" key={offset}>
                  <div className="trust-ticker__rows">
                    {rows.map((message, i) => {
                      const isClone = i === 2;
                      return (
                        <div
                          key={`${message}-${i}`}
                          aria-hidden={isClone}
                          className={`trust-ticker__row flex items-center gap-2 ${isClone ? "trust-ticker__row--clone" : ""}`}
                        >
                          <Check size={14} className="shrink-0 text-ink/60" />
                          <p className="min-w-0 truncate text-xs text-ink/70">{message}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* `.product__content-grid`: kenarlikli, kose yariçapi 1.4rem,
              ikon+etiket dikey kutu, 3 sutun - sadece orta+genis ekranda
              gorunur (`small-hide`, bkz. canli CSS). */}
          <div className="hidden grid-cols-3 gap-[8px] md:grid">
            {STATIC_TRUST_ITEMS.map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="flex flex-col items-center justify-center gap-2 rounded-[14px] border border-line p-4 text-center"
              >
                <Icon size={20} className="text-ink" />
                <span className="text-[10px] uppercase tracking-wide text-ink">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>

    {/* Zoom lightbox: `yet-another-react-lightbox` + Zoom eklentisi (bkz.
        MOBIL_KATALOG..._PLANI.md 4d). Elle yazilmis sabit 2x zoom + tiklanan
        noktaya transform-origin'in yerini aldi - kutuphane pinch-zoom, zoomlu
        halde parmakla pan (gezinme) VE zoomluyken bile sonraki/onceki
        gorsele swipe'i kendi ic mantigiyla veriyor. Kapat/Escape/ok
        tuslari, klavye navigasyonu ve body scroll-lock de kutuphanenin
        kendisinden geliyor - ayrica kod yazmaya gerek yok. */}
    <Lightbox
      open={lightboxIndex !== null}
      close={() => setLightboxIndex(null)}
      index={lightboxIndex ?? 0}
      on={{
        // `index` prop kontrollu (controlled) verildigi icin lightboxIndex
        // burada guncellenmezse YARL'in kendi ic navigasyonu (ok tuslari,
        // swipe, zoomluyken pan siniri asilinca gecis) her render'da eski
        // index'e "geri senkronlaniyor" gibi davranip aynı fotografta
        // takili kaliyordu - kullanicinin bildirdigi hata buydu.
        view: ({ index }) => {
          setLightboxIndex(index);
          setActiveImage(index);
          emblaMainApi?.scrollTo(index, true);
        }
      }}
      slides={galleryImages.map((img) => ({ src: img.url, alt: img.alt }))}
      plugins={[Zoom]}
      zoom={{ maxZoomPixelRatio: 3, doubleTapDelay: 300, doubleClickDelay: 300 }}
      carousel={{ finite: galleryImages.length <= 1 }}
      styles={{
        container: { backgroundColor: "rgba(17,17,17,0.95)" },
        button: { filter: "none", color: "#fffdf9" },
        // Beyaz/acik renkli urun fotograflarinda (kirik beyaz zemin gibi)
        // sadece beyaz renkli oklar arka planla neredeyse hic kontrast
        // olusturmuyor, gorunmez hale geliyordu - kullanicinin bildirdigi
        // sorun buydu. Ok butonlarina (zoom in/out/kapat degil, sadece
        // sol/sag navigasyon) koyu, yari saydam dairesel bir arka plan
        // eklendi - hangi fotografin uzerinde olursa olsun okunakli kalir.
        navigationPrev: {
          backgroundColor: "rgba(17,17,17,0.55)",
          borderRadius: "9999px",
          padding: 8
        },
        navigationNext: {
          backgroundColor: "rgba(17,17,17,0.55)",
          borderRadius: "9999px",
          padding: 8
        }
      }}
    />

    {/* Icerik Bollmark'in gercek iade politikasindan (HUKUKI_SAYFALAR_ICERIK_
        VE_PLAN.md "Teslimat ve İade Şartları") ozetlendi - Koton'un metni
        DEGIL: kullanici bunun sadece Urun Bakim Talimati icin (asagida)
        gecerli oldugunu, Iade & Degisim'in orijinal Bollmark metnine geri
        alinmasi gerektigini belirtti. */}
    <InfoDrawer open={iadeDrawerOpen} onClose={() => setIadeDrawerOpen(false)} title="İade & Değişim">
      <div className="space-y-5 text-sm leading-relaxed text-ink/70">
        <p>
          Bollmark üzerinden yaptığınız alışverişlerde, ürünü teslim aldığınız tarihten itibaren 14 gün
          içinde hiçbir gerekçe göstermeksizin cayma hakkınızı kullanabilir, ürünü iade edebilirsiniz.
        </p>
        <div>
          <p className="font-medium text-ink">İadesi Mümkün Olmayan Ürünler</p>
          <p className="mt-1">
            İç giyim, mayo ve bikini gibi hijyen açısından hassas ürünler; ambalajı/etiketi açılmış veya
            kullanılmışsa iade kapsamı dışındadır.
          </p>
        </div>
        <div>
          <p className="font-medium text-ink">İade Adımları</p>
          <ol className="mt-1 list-decimal space-y-1 pl-4">
            <li>bilgi@bollmark.com adresine sipariş numaranızla iade talebinizi iletin.</li>
            <li>
              Ürünü faturası, orijinal kutusu/ambalajı ve etiketleriyle birlikte, kullanılmamış ve hasarsız
              şekilde paketleyin.
            </li>
            <li>Belirtilen adrese gönderin.</li>
            <li>İade kargo ücreti alıcıya aittir.</li>
            <li>Ürün elimize ulaşıp kontrolü tamamlandıktan sonra bedeli en geç 14 gün içinde ödeme yaptığınız yönteme iade edilir.</li>
          </ol>
        </div>
        <p className="text-xs text-ink/50">Detaylı bilgi için Teslimat ve İade Şartları sayfamızı inceleyebilirsiniz.</p>
      </div>
    </InfoDrawer>

    {/* Icerik Koton'un canli sitesinden birebir alindi, hic degistirilmedi
        (marka/urun adi gecmiyor, tamamen genel bir bakim rehberi - bkz.
        URUN_DETAY_IADE_BAKIM_BEDEN_TABLOSU_PLANI.md v2, ICERIK 2). Ustte
        (varsa) urunun kendi careInstructions'i, altinda bu genel metin. */}
    <InfoDrawer open={bakimDrawerOpen} onClose={() => setBakimDrawerOpen(false)} title="Ürün Bakım Talimatı">
      <div className="space-y-4 text-sm leading-relaxed text-ink/70">
        {careInstructions && (
          <div>
            <p className="font-medium text-ink">Bu ürün için</p>
            <p className="mt-1">{careInstructions}</p>
          </div>
        )}
        <p className="font-medium text-ink">Genel Bakım Uyarıları: Ürünlerin Doğru Bakımı</p>
        <p>
          Çevreyi ve doğal kaynaklarımızı korumanın ilk adımlarından biri, ürün ve giysi bakımında önerilen
          talimatları doğru bir şekilde uygulamaktır. Ürünlere uygun bakım ve yıkama talimatlarını
          uygulayarak çevremizi ve kaynaklarımızı korumanın yanı sıra giysilerin kullanım ömrünü uzatma
          şansı da yakalayabiliriz. Satın aldığınız ürünün her yıkama sonrası ilk günkü gibi canlı bir
          görünüme sahip olması için yapmanız gerekenlere bakacak olursak;
        </p>
        <p>
          <strong className="text-ink">1. Ürün Etiketlerine Önem Verin:</strong> Giysi veya ürünlerinizin
          bakım etiketlerini hem satın alma aşamasında hem de bakım ve yıkama işlemi öncesinde dikkatlice
          incelemek doğru bakım sürecinin ilk adımı olacaktır. Bu etiketler, ürünlerin kumaş yapısına uygun
          bakım ve yıkama talimatları içerir. Ürünlere uygulayabileceğiniz işlemler, yıkama ve bakım
          önerilerinin yanı sıra kumaş içeriklerini de görebileceğiniz bu etiketler ürünlerin doğru bakımı
          konusunda bilgi sahibi olmanıza olanak sağlayacaktır.
        </p>
        <p>
          <strong className="text-ink">2. Önerilen Bakım Talimatlarına Uyun:</strong> Dolabınıza
          ekleyeceğiniz her giysi, ayakkabı ve aksesuar ürünü için farklı bir bakım yöntemi oluşturmanız
          gerekir. Ürünün kumaş içeriğine, tasarımına ve yapısına göre değişebilen bu yöntemleri doğru
          uygulamak oldukça önemlidir. Ürün için önerilen talimatlara uygun şekilde bakım yapmak
          ürününüzün kullanım süresi uzarken, rengini ve dokusunu uzun süre muhafaza etmenizi de
          kolaylaştıracaktır.
        </p>
        <p>
          <strong className="text-ink">3. Yüksek Dereceli Yıkama İşlemlerinden Kaçının:</strong> Ürün
          bakımı ve yıkama işlemlerinde çevre dostu ve tasarruf sağlayan yöntemleri tercih etmek uzun
          vadede oldukça faydalıdır. Yüksek dereceli yıkama işlemlerinden kaçınarak siz de ürününüzün
          kullanım süresini uzatırken kalitesini uzun süre korumasına yardımcı olabilirsiniz. Özellikle iç
          çamaşırı ve beyaz renkli ürünlerde sık sık tercih edilen yüksek dereceli yıkama işlemleri
          ürünlerinizin dokusunda hasar oluşturmanın yanı sıra tasarım detaylarına ve kalıplarına da zarar
          verebilir. Ürünün etiketinde yer alan yıkama derecesine sadık kalmak ürününüz için doğru olan
          bakım adımlarından birini daha tamamlamanızı sağlayacaktır.
        </p>
        <p>
          <strong className="text-ink">4. Fazla Deterjan Kullanımından Kaçının:</strong> Ürün yıkama
          işlemi sırasında deterjan kullanımını minimum düzeyde tutmak çevresel ve bireysel sağlık
          açısından oldukça önemlidir. Yıkama esnasında önerilen deterjan miktarını aşmak ürünlerinizin
          daha hijyenik olmasına değil; aksine daha fazla kimyasal maddeye maruz kalarak hasar görmesine
          sebep olabilir. Bu nedenle yıkama işlemi başlamadan önce deterjan miktarını ölçek yardımı ile
          belirleyerek fazla deterjan kullanımından kaçınmalısınız. Bir diğer yandan, yıkama işlemi
          esnasında deterjan çeşitlerinin yanı sıra yumuşatıcı ve leke çıkarıcı gibi kimyasal maddelerin
          kullanımını en aza indirgemek de çevreyi ve ürünlerinizi korumak adına atacağınız etkili bir
          adım olacaktır.
        </p>
        <p>
          <strong className="text-ink">5. Yıkama İşlemlerinde Renk Ayrımını Gözetin:</strong>
          Giysilerinizi yıkamadan önce renk ve dokularına göre ayırmak ürünlerinizin yapısını korumanın
          öncelikleri arasında yer alır. Yüksek sıcaklık ve basınçlı suya maruz kalan ürünler kimi zaman
          beraber yıkandıkları diğer ürünlere renk verebilir. Özellikle içerisinde indigo boya bulunan
          bazı kumaşlar yıkama esnasından yüksek oranda renk bırakabilir. Bu nedenle yıkama işlemi
          öncesinde ürünlerinizi benzer renkler bir arada yıkanacak şekilde ayırmanız ürün bakım sürecinize
          yarar sağlayacak bir yöntem olacaktır. Beyazlar, koyu renkler ve açık renkler gibi renk tonlarına
          göre ayırarak yıkama işlemini gerçekleştirdiğiniz ürünler renklerini ve dokularını uzun süre
          muhafaza edecektir.
        </p>
        <p>
          <strong className="text-ink">6. Yıkama İşlemlerinde Ağartıcı Kullanmayın:</strong> Ürün bakım
          sürecinde kimyasal madde kullanımını en az seviyede tutmak önceliğiniz olmalı. Bu kimyasallar
          arasında oldukça güçlü bir etkiye sahip olan ağartıcı maddeleri ürün yıkama işleminin öncesinde
          ve yıkama işlemi esnasında kullanmaktan kaçınmanızı öneririz. Çevreye olan zararının yanı sıra
          cildinizi irrite edecek bir etkiye de sahip olan ağartıcı maddelere alternatif olacak leke
          çıkarıcı ve doğal içerikli ürünleri tercih edebilirsiniz. Bu şekilde hem ürünlerinizin renk,
          doku ve tasarımını koruyabilir hem de ağartıcı maddelerin çevresel ve bireysel zararlarına karşı
          önlem alabilirsiniz.
        </p>
        <p>
          <strong className="text-ink">7. Baskılı/Nakışlı Ürünleri Ütülemeden ve Yıkamadan Önce Ters
          Çevirin:</strong> Ürün bakımı süresince dikkat etmenizi önerdiğimiz bir diğer aşama ise baskılı,
          pullu ve nakışlı tasarımlara sahip ürünleri her işlem öncesi ters çevirmeniz olacak. Özellikle
          nakışlı ve işlemeli tasarımlar, genellikle el işçiliği kullanılarak hazırlanmaları sebebiyle
          ekstra hassaslık gerektirir. Ters çevirme yöntemi ile ürünlerinizin rengini ve desenini korurken
          işlemler esnasında oluşabilecek fiziksel hasarlara karşı da önlem almış olursunuz. Ters çevirme
          adımı ile ürünleriniz tasarımları ve dokuları değişmeden, ilk günkü gibi kullanabileceğiniz
          şekilde dolabınızda yer almaya devam edecektir.
        </p>
        <p className="pt-2 font-medium text-ink">ÜRÜN BAKIMINDA 3 ANA İŞLEM</p>
        <p>
          <strong className="text-ink">1. Yıkama İşlemi:</strong> Ürünlerin ve giysilerin etiketinde yer
          alan yıkama talimatlarını doğru uygulamak, çevreyi ve doğal kaynakları koruma yolculuğunda
          atacağınız önemli adımlardan biri. Üç ana adıma ayıracağımız bakım sürecinde dikkate almanız
          gereken ilk önerimiz giysi ve ürünlerinizi yalnızca ihtiyaç duyduğunuz zamanlarda yıkamak
          olacak. Gereğinden fazla yapılan bakım, ütü ve yıkama işlemlerinin uzun vadede ürünlerinizin
          dokusuna ve kalıbına zarar verme olasılığı oldukça yüksektir. Sonrasında ise ürünlerinizin kumaş
          ve tasarım özelliklerine uygun olacak yıkama şeklini belirlemeniz gerekecek. Ürünlerin
          etiketlerinde yer alan yıkama talimatları bu adımda size büyük bir yarar sağlayacaktır. Etiket
          bilgilerinde yer alan sıcaklık, yıkama yöntemi ve program gibi detayları inceleyerek ürününüz
          için uygun olacak yıkama işlemini belirleyebilirsiniz.
        </p>
        <p>Gelin en sık tercih edilen yıkama biçimlerine birlikte göz atalım,</p>
        <p>
          <strong className="text-ink">Elde Yıkama:</strong> Hassas kumaş türleri kullanılarak tasarlanan
          ya da nakışlı ve desenli tasarımlara sahip ürünler makinede yıkama işlemiyle zarar görebilir.
          Ürününüzün hem dokusunu hem de tasarımını koruma altına alacak yıkama işlemlerinden biri olan
          elde yıkama yöntemi, doğru su sıcaklığı ve deterjan kullanımıyla ürününüzün ihtiyaç duyduğu
          hassasiyeti sağlayacaktır.
        </p>
        <p>
          <strong className="text-ink">Makinede Yıkama:</strong> Yıkama yöntemleri arasında hem tasarruflu
          hem de pratik bir yöntem olarak kabul edilen makinede yıkama işlemini genel olarak iki şekilde
          sınıflandırabiliriz:
        </p>
        <p>
          <strong className="text-ink">Normal Programda Yıkama:</strong> Makinede yıkama programları
          arasında en sık tercih edilenler arasında normal yıkama programlarının olduğunu söyleyebiliriz.
          Günlük kıyafetleriniz için tercih edebileceğiniz normal yıkama programları ürünlerinizi ideal
          şekilde temizlemenin en tasarruflu yollarından biri. Normal yıkama programlarında dikkat
          etmeniz gereken tek şey ürünün benzer renklerle yıkanması ve etiketinde yer alan su sıcaklık
          derecesine uygun bir program tercih etmek olacak.
        </p>
        <p>
          <strong className="text-ink">Hassas Programda Yıkama:</strong> Hassas, dokulu veya el
          işçiliğiyle hazırlanan ürünleri makinede yıkamak için en uygun seçeneğin hassas programlar
          olduğunu söyleyebiliriz. Hassas yıkama programlarını aynı zamanda yüksek ısı, yoğun sıkma ve
          durulama işlemleriyle kumaş dokusu zedelenebilecek ürünler için de tercih edebilirsiniz. Ürün
          bakım talimatlarında görebileceğiniz bu programlar ürününüze zarar vermeden yıkamak için en
          doğru seçenek olacaktır.
        </p>
        <p>
          <strong className="text-ink">2. Kurutma İşlemi:</strong> Ürünlerinizin dokusunu ve rengini uzun
          süre koruyacak bir diğer işlem ise elbette kurutma işlemi. Giysilerinizin önerilen kurutma
          talimatlarına uygun şekilde kurutmak bakım ve yıkama işlemi kadar önem arz ediyor. Genellikle
          etiket ve ürün bilgi alanlarında yer alan bu talimatlar ürünlerinizi kumaş ve tasarım
          modellerine uygun olacak şekilde hazırlanıyor. Doğrudan güneş ışığından kaçınmanın yanı sıra
          kalorifer ve ısıtıcı gibi araçlarla giysilerinizi temas ettirmeden kurutma işlemini
          gerçekleştirmelisiniz. Hassas kumaş yapılı ürünlerde ise oda sıcaklığında askı yöntemi ile
          kurutma işlemini tamamlayabilirsiniz.
        </p>
        <p>
          <strong className="text-ink">3. Ütüleme İşlemi:</strong> Ütüleme işlemi, ürününüze
          uygulayacağınız doğru bakım sürecinin son adımı olarak kabul edilebilir. Yıkama, bakım ve
          kurutma işleminin ardından ürünün yapısına uyacak ütü ısı derecesi ile ütü işlemine
          başlayabilirsiniz. Ürünleri ters çevirerek ütülemek, bakım talimatlarında yer alan ısı
          derecesini geçmemeniz, fermuarlı ürünlerde bu bölgelere es geçerek ve ürünlerinizi hafif
          nemliyken ütülemeye başlamak bu adımda size önereceğimiz birkaç küçük ipucu olacak. Yıkama ve
          kurutma işleminde olduğu gibi ütü işleminde de yüksek ısılı programlardan kaçınmak ürünün
          yapısında oluşabilecek zararlara karşı koruyucu bir önlem olacaktır.
        </p>
        <p>
          <strong className="text-ink">Kuru Temizleme İşlemi:</strong> Kuru temizleme işlemi, makinede
          veya elde yıkamaya uygun olmayan ürünler için tercih edebileceğiniz bakım yöntemlerinden
          biridir. Bu yöntem, hassas kumaş yapısına sahip olan veya tasarımında el işçiliği bulunan
          ürünler için uygun olacak özel bir bakım işlemidir. Genellikle abiye elbise, takım elbise ve dış
          giyim ürünleri gibi elde ve makinede temizlenmesi sakıncalı olacak ürünler için tavsiye edilen
          kuru temizleme işlemi simgesi, ürününüzün etiketinde yer alan bakım talimatları bölümünde yer
          almaktadır.
        </p>
      </div>
    </InfoDrawer>

    <SizeGuideModal open={sizeGuideModalOpen} onClose={() => setSizeGuideModalOpen(false)} />
    </>
  );
}
