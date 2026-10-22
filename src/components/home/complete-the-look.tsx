"use client";

import { useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useCart } from "@/lib/cart";
import { formatPrice } from "@/lib/format";
import type { ProductCardData } from "@/components/product-card";

export type CompleteLookItem = {
  productId: string;
  name: string;
  hotspot: { x: number; y: number } | null;
  // Renk basina kart verisi (stoklu renkler); tek renkli urunde tek eleman.
  options: ProductCardData[];
};

export type CompleteLookBundle = {
  id: string;
  name: string;
  discountPercent: number;
  imageUrl: string | null; // anasayfada hep dolu; /kombin sayfasinda fotografsiz kombin de olabilir
  items: CompleteLookItem[];
};

function optionHref(option: ProductCardData) {
  return option.colorLabel
    ? `/urunler/${option.slug}?renk=${encodeURIComponent(option.colorLabel)}`
    : `/urunler/${option.slug}`;
}

function Price({ option }: { option: ProductCardData }) {
  const { finalPriceCents, originalPriceCents, badgePercent } = option.priceResolution;
  return (
    <span className="flex items-center gap-2 text-[12px] tracking-[0.48px]">
      <span className={badgePercent ? "text-[rgb(194,81,81)]" : "text-ink"}>{formatPrice(finalPriceCents)}</span>
      {originalPriceCents != null && <span className="text-ink line-through">{formatPrice(originalPriceCents)}</span>}
    </span>
  );
}

const pillClass = (active: boolean) =>
  `flex h-7 min-w-[28px] items-center justify-center rounded-md border px-1.5 text-[11px] leading-none tracking-[0.4px] transition-colors ${
    active ? "border-ink bg-ink text-cream" : "border-ink/25 text-ink hover:border-ink"
  }`;

// Tek kombin: solda (telefonda ustte) 4:5 fotograf ve "+" noktalari, yaninda
// urun listesi. Her satirda renk (birden fazlaysa) ve beden secilir; tek
// secenekli olan kendiliginden secili gelir. Buton hepsini sepete ekler -
// kombin indirimi sepette resolveBundleDiscount ile ayrica dusulur, burada
// fiyata gomulmez (kart hizli-ekle ile ayni kural, bkz. product-card.tsx).
// large: /kombin/[id] sayfasi (daha genis fotograf). Fotografsiz kombinde
// yalniz baslik + liste, tek sutun.
export function CompleteLook({
  bundle,
  header,
  large = false
}: {
  bundle: CompleteLookBundle;
  header: ReactNode;
  large?: boolean;
}) {
  const { addLine, openDrawer } = useCart();
  const [activeSpot, setActiveSpot] = useState<string | null>(null);
  const [selection, setSelection] = useState<Record<string, { option: number; variantId: string | null }>>(() =>
    Object.fromEntries(
      bundle.items.map((item) => {
        const variants = item.options[0].quickAddVariants ?? [];
        return [
          item.productId,
          {
            option: 0,
            variantId: variants.length === 1 ? variants[0].variantId : null
          }
        ];
      })
    )
  );
  const [showMissing, setShowMissing] = useState(false);
  const [justAdded, setJustAdded] = useState(false);

  const selectedOption = (item: CompleteLookItem) => item.options[selection[item.productId].option];

  function selectColor(item: CompleteLookItem, option: number) {
    const variants = item.options[option].quickAddVariants ?? [];
    setSelection((prev) => ({
      ...prev,
      [item.productId]: {
        option,
        variantId: variants.length === 1 ? variants[0].variantId : null
      }
    }));
  }

  function selectSize(item: CompleteLookItem, variantId: string) {
    setSelection((prev) => ({
      ...prev,
      [item.productId]: { ...prev[item.productId], variantId }
    }));
  }

  function addAll() {
    if (bundle.items.some((item) => !selection[item.productId].variantId)) {
      setShowMissing(true);
      return;
    }
    for (const item of bundle.items) {
      const option = selectedOption(item);
      const variant = option.quickAddVariants?.find((v) => v.variantId === selection[item.productId].variantId);
      if (!variant) continue;
      addLine({
        productId: option.productId,
        variantId: variant.variantId,
        name: option.name,
        size: variant.size,
        color: variant.color,
        priceCents: option.priceCents,
        compareAtCents:
          option.compareAtCents && option.compareAtCents > option.priceCents ? option.compareAtCents : null,
        image: option.image,
        quantity: 1,
        greyBackdrop: option.greyBackdrop
      });
    }
    setShowMissing(false);
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1800);
    openDrawer();
  }

  const photo = bundle.imageUrl;
  return (
    // Telefonda: baslik, fotograf, liste alt alta. md+: fotograf solda iki
    // satir boyunca, sagda baslik (alta yasli) + liste (uste yasli) - ikili
    // fotografin ortasina hizalanir, liste dar kaldigi icin buton da kisa.
    <div
      className={
        !photo
          ? "mx-auto grid max-w-[480px] gap-6"
          : large
            ? "mx-auto grid max-w-[1240px] gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,460px)] md:grid-rows-[1fr_auto_1fr] md:gap-x-12 lg:gap-x-20"
            : "mx-auto grid max-w-[1040px] gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,440px)] md:grid-rows-[1fr_auto_1fr] md:gap-x-12 lg:gap-x-20"
      }
    >
      <div className={photo ? "md:col-start-2 md:row-start-1 md:self-end" : ""}>{header}</div>
      {photo && (
        <div
          className="relative aspect-[4/5] overflow-hidden bg-image-bg md:col-start-1 md:row-span-3 md:row-start-1"
          onClick={() => setActiveSpot(null)}
        >
          <Image
            src={photo}
            alt={bundle.name}
            fill
            priority={large}
            sizes={large ? "(min-width: 768px) 760px, 100vw" : "(min-width: 768px) 560px, 100vw"}
            className="object-cover"
          />
          {bundle.items.map((item) => {
            if (!item.hotspot) return null;
            const option = selectedOption(item);
            const open = activeSpot === item.productId;
            const { x, y } = item.hotspot;
            return (
              <div key={item.productId} className="absolute" style={{ left: `${x}%`, top: `${y}%` }}>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveSpot(open ? null : item.productId);
                  }}
                  aria-expanded={open}
                  aria-label={`${item.name}: ürün bilgisi`}
                  className={`flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-cream text-ink shadow-[0_2px_10px_rgba(0,0,0,0.25)] transition-transform duration-300 ${
                    open ? "rotate-45" : "hover:scale-110"
                  }`}
                >
                  <Plus size={16} strokeWidth={1.75} />
                </button>
                {open && (
                  <Link
                    href={optionHref(option)}
                    onClick={(e) => e.stopPropagation()}
                    className={`absolute z-10 block w-44 bg-cream px-3 py-2.5 shadow-[0_6px_24px_rgba(0,0,0,0.18)] ${
                      x > 50 ? "right-5" : "left-5"
                    } ${y > 60 ? "bottom-5" : "top-5"}`}
                  >
                    <span className="line-clamp-2 text-[11px] font-semibold uppercase leading-[14px] tracking-[0.48px] text-ink">
                      {item.name}
                    </span>
                    <span className="mt-1 block">
                      <Price option={option} />
                    </span>
                    <span className="mt-1.5 block text-[10px] uppercase tracking-[0.1em] text-ink/60">Ürüne git →</span>
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className={photo ? "md:col-start-2 md:row-start-2" : ""}>
        <ul className="border-t border-line">
          {bundle.items.map((item) => {
            const option = selectedOption(item);
            const sel = selection[item.productId];
            const variants = option.quickAddVariants ?? [];
            const missing = showMissing && !sel.variantId;
            return (
              <li
                key={item.productId}
                className="grid grid-cols-[64px_1fr] gap-3 border-b border-line py-3 md:grid-cols-[80px_1fr] md:gap-4"
              >
                <Link
                  href={optionHref(option)}
                  className={`relative aspect-[3/4] overflow-hidden ${option.greyBackdrop ? "bg-image-bg" : "bg-line"}`}
                >
                  <Image
                    src={option.image}
                    alt={item.name}
                    fill
                    sizes="80px"
                    className={`object-cover${option.greyBackdrop ? " mix-blend-multiply" : ""}`}
                  />
                </Link>
                <div className="min-w-0">
                  <Link
                    href={optionHref(option)}
                    className="line-clamp-2 text-[12px] font-semibold uppercase leading-[15px] tracking-[0.48px] text-ink hover:underline"
                  >
                    {item.name}
                  </Link>
                  <div className="mt-1">
                    <Price option={option} />
                  </div>
                  {item.options.length > 1 && (
                    <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="Renk">
                      {item.options.map((o, i) => (
                        <button
                          key={o.colorLabel ?? i}
                          type="button"
                          onClick={() => selectColor(item, i)}
                          aria-pressed={sel.option === i}
                          className={pillClass(sel.option === i)}
                        >
                          {o.colorLabel}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="Beden">
                    {variants.map((v) => (
                      <button
                        key={v.variantId}
                        type="button"
                        onClick={() => selectSize(item, v.variantId)}
                        aria-pressed={sel.variantId === v.variantId}
                        className={pillClass(sel.variantId === v.variantId)}
                      >
                        {v.size || "Tek beden"}
                      </button>
                    ))}
                  </div>
                  {missing && <p className="mt-1.5 text-[11px] text-[rgb(194,81,81)]">Beden seçin</p>}
                </div>
              </li>
            );
          })}
        </ul>
        <button
          type="button"
          onClick={addAll}
          disabled={justAdded}
          className="mt-5 w-full rounded-full bg-ink px-6 py-3 text-[11px] uppercase tracking-wide text-cream transition hover:bg-clay disabled:opacity-80"
        >
          {justAdded ? "Sepete eklendi" : `Kombini sepete ekle · %${bundle.discountPercent} indirim`}
        </button>
        <p className="mt-2 text-center text-[11px] text-ink/50">
          İndirim, kombinin tüm parçaları sepetteyken uygulanır.
        </p>
      </div>
    </div>
  );
}

// Anasayfa "Kombini Tamamla" (bkz. home-products.ts pickHomeBundles). Kombin
// yoksa bolum hic cikmaz. Ekranda tek kombin; birden fazlaysa basligin
// yaninda oklar ve "1 / 2" sayaci (yana kaydirma, genis ekranda yarim gorunen
// ikinci kombin yuzunden dagilmis duruyordu).
export function CompleteTheLook({ bundles }: { bundles: CompleteLookBundle[] }) {
  const [index, setIndex] = useState(0);
  if (bundles.length === 0) return null;
  const bundle = bundles[Math.min(index, bundles.length - 1)];
  const go = (step: number) => setIndex((i) => (i + step + bundles.length) % bundles.length);

  const header = (
    <div>
      <h2 className="whitespace-nowrap font-display text-3xl font-normal tracking-[-0.04em] md:text-5xl">
        Kombini <em className="font-accent italic font-normal">tamamla</em>
      </h2>
      <div className="mt-3 flex min-h-6 items-center justify-between gap-4">
        <p className="text-[10px] font-medium uppercase tracking-[0.1em] text-ink/60">{bundle.name}</p>
        {bundles.length > 1 && (
          <div className="flex shrink-0 items-center gap-3 pb-0.5">
            <button
              type="button"
              onClick={() => go(-1)}
              aria-label="Önceki kombin"
              className="flex h-6 w-6 items-center justify-center text-ink transition-opacity hover:opacity-60"
            >
              <ChevronLeft size={22} strokeWidth={1.25} />
            </button>
            <span className="text-[11px] tabular-nums tracking-[0.1em] text-ink/60" aria-live="polite">
              {index + 1} / {bundles.length}
            </span>
            <button
              type="button"
              onClick={() => go(1)}
              aria-label="Sonraki kombin"
              className="flex h-6 w-6 items-center justify-center text-ink transition-opacity hover:opacity-60"
            >
              <ChevronRight size={22} strokeWidth={1.25} />
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <section className="px-4 pb-section md:px-6 xl:px-9">
      <CompleteLook key={bundle.id} bundle={bundle} header={header} />
    </section>
  );
}
