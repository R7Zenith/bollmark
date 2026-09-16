"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import useEmblaCarousel from "embla-carousel-react";
import { useRouter } from "next/navigation";
import { Heart, Minus, Plus, Truck, RotateCcw, ShieldCheck, Check, ZoomIn, Clock } from "lucide-react";
import Lightbox from "yet-another-react-lightbox";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import "yet-another-react-lightbox/styles.css";
import { useCart } from "@/lib/cart";
import { useWishlist } from "@/lib/wishlist";
import { formatPrice } from "@/lib/format";
import { effectivePrice } from "@/lib/variant";

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
  // Mobilde fotografin ustunde gosterilen "Anasayfa / Kadin / Elbise" gibi
  // gezinme yolu (bkz. urunler/[slug]/page.tsx) - Koton'un urun sayfasindaki
  // konum bildirimiyle birebir ayni yerde.
  breadcrumb?: { label: string; href: string }[];
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
  // guide"`), asagidaki ayri "Beden Tablosu" accordion'undan bagimsiz bir
  // kisayol - tiklaninca ayni accordion'u acip oraya kaydiriyor.
  const sizeGuideRef = useRef<HTMLDetailsElement>(null);
  const openSizeGuide = () => {
    const el = sizeGuideRef.current;
    if (!el) return;
    el.open = true;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
  };

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
        {/* Mobilde bu satir yerine fotografin ustundeki breadcrumb (Anasayfa
            / Kadin / Elbise) gosteriliyor - Koton'da urun basliginin
            ustunde ayrica kategori/marka satiri yok, tek konum bilgisi
            fotografin uzerindeki gezinme yolu. */}
        {(categoryName || brandName) && (
          <p className="hidden text-xs uppercase tracking-widest2 text-clay md:block">
            {[categoryName, brandName].filter(Boolean).join(" · ")}
          </p>
        )}
        {/* Release'de `.product__badges` basligin UZERINDE ayri bir blok -
            ama bu SADECE indirim/kampanya rozeti icin (bkz. top-8 canli
            HTML'i, 13 Eylul 2026). Kose yariçapi --badge-border-radius:
            0.4rem. Dusuk stok uyarisi ORADA DEGIL - accessibility snapshot'i
            ile dogrulandi (12 Eylul 2026, Playwright): gercek DOM'da "Only N
            left in stock" satiri butonlarin ALTINDA, saat ikonuyla ayri bir
            status satiri - asagida o konuma tasindi. */}
        {automaticDiscount && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-[4px] bg-sale px-2 py-1 text-[10px] font-medium uppercase tracking-[1.4px] text-cream">
              %{automaticDiscount.percent} İndirim
            </span>
          </div>
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
            {automaticDiscount ? (
              <>
                <span className="text-[16px] font-semibold text-sale md:text-[14px] md:font-medium">
                  {formatPrice(Math.round((selectedPriceCents * (100 - automaticDiscount.percent)) / 100))}
                </span>
                <span className="text-ink/40 line-through">{formatPrice(selectedPriceCents)}</span>
              </>
            ) : (
              <>
                <span
                  className={`text-[16px] font-semibold md:text-[14px] ${compareAtCents && compareAtCents > selectedPriceCents ? "text-sale md:font-medium" : "md:font-normal"}`}
                >
                  {formatPrice(selectedPriceCents)}
                </span>
                {compareAtCents && compareAtCents > selectedPriceCents && (
                  <span className="text-ink/40 line-through">{formatPrice(compareAtCents)}</span>
                )}
              </>
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
        {descriptionHtml && (
          <div className="mt-6">
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

        {sizeGuide && (
          <details ref={sizeGuideRef} className="mt-3 border-t border-line pt-6">
            <summary className="cursor-pointer text-[16px] tracking-[-0.64px] text-ink underline decoration-transparent underline-offset-[5px] transition duration-300 hover:decoration-ink">
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
                    className={`flex h-7 min-w-[28px] items-center justify-center rounded-none border border-ink px-3 text-xs uppercase leading-none tracking-[1px] transition duration-300 ${
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
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs uppercase tracking-wide text-ink/60">Beden</p>
                {sizeGuide && (
                  <button
                    type="button"
                    onClick={openSizeGuide}
                    className="text-xs uppercase tracking-wide text-ink underline underline-offset-4 hover:text-ink/70"
                  >
                    Beden Rehberi
                  </button>
                )}
              </div>
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
                    className={`flex h-7 min-w-[28px] items-center justify-center rounded-none border border-ink px-1 text-xs leading-none tracking-[1px] transition duration-300 ${
                      size === s ? "bg-ink text-cream" : "bg-transparent text-ink hover:bg-ink/5"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
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
                  disabled={quantity <= 1}
                  aria-label="Adedi azalt"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition duration-300 hover:bg-line disabled:opacity-30"
                >
                  <Minus size={14} />
                </button>
                <span className="text-center text-sm">{quantity}</span>
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.min(selected?.stock ?? 1, q + 1))}
                  disabled={quantity >= (selected?.stock ?? 1)}
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

          {!outOfStock && selected.stock <= LOW_STOCK_THRESHOLD && (
            <p className="flex items-center gap-2 text-xs text-ink/70">
              <Clock size={14} className="shrink-0 text-ink/60" />
              Son {selected.stock} adet kaldı. Acele edin.
            </p>
          )}

          {added && (
            <button
              onClick={() => router.push("/sepet")}
              className="w-full rounded-full border border-ink py-3 text-sm uppercase tracking-wide hover:bg-ink hover:text-cream"
            >
              Sepete Git
            </button>
          )}

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
    </>
  );
}
