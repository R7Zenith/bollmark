"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ProductCard, type ProductCardData } from "@/components/product-card";

// Masaustunde ayni anda 4 kart gorunur (Shopify Release "just arrived"
// slider'i referansi, bkz. component-card-product-slider.css swiper
// options: slidesPerViewDesktop:4, spaceBetweenDesktop:24) - bir oka
// basinca TEK bir urun genisligi kadar kayar, 4'erli sayfalama yapmaz.
// Ucta sonsuz donguye girmez, ok disabled olur.
const VISIBLE_DESKTOP = 4;
const GAP_DESKTOP = 24;

export function FeaturedCarousel({ products }: { products: ProductCardData[] }) {
  const total = products.length;
  const maxIndex = Math.max(0, total - VISIBLE_DESKTOP);
  const [index, setIndex] = useState(0);

  const canPrev = index > 0;
  const canNext = index < maxIndex;

  // Kart genisligi toplam urun sayisindan (total) BAGIMSIZ, yalniz
  // kapsayici genislik + gorunur kart sayisi + gap'e gore hesaplaniyor
  // (gercek Swiper'in slaytlari boyutlandirma mantigi ayni budur). Boylece
  // herhangi bir index'te gorunen 4 kart + aralarindaki 3 gap TAM OLARAK
  // kapsayicinin genisligini doldurur - hem ilk hem SON gorunen kartin
  // kenari container ile (dolayisiyla basliktaki ok/Tumunu Gor ile) her
  // zaman birebir hizali kalir. % degerleri translateX'te ve kart
  // genisliginde ayni referans kutuya (track'in kendi genisligine, w-full
  // ile kapsayiciya esitlendi) gore cozuluyor.
  const itemWidthCss = `calc((100% - ${GAP_DESKTOP * (VISIBLE_DESKTOP - 1)}px) / ${VISIBLE_DESKTOP})`;
  const stepCss = `calc((100% + ${GAP_DESKTOP}px) / ${VISIBLE_DESKTOP})`;

  return (
    <>
      <div className="mb-10 flex items-end justify-between md:mb-12">
        <h2 className="font-display text-3xl font-normal tracking-[-0.04em] md:text-5xl">Yeni Gelenler</h2>
        <div className="flex items-center gap-6">
          <Link
            href="/urunler"
            className="link-shrink-underline text-[10px] font-medium uppercase tracking-[0.1em] text-ink"
          >
            Tümünü Gör
          </Link>
          {total > VISIBLE_DESKTOP && (
            <div className="hidden items-center gap-4 md:flex">
              <button
                type="button"
                onClick={() => setIndex((i) => Math.max(0, i - 1))}
                disabled={!canPrev}
                aria-label="Önceki ürünler"
                aria-disabled={!canPrev}
                className="flex h-6 w-6 items-center justify-center text-ink transition-opacity hover:opacity-60 disabled:opacity-50 disabled:hover:opacity-50"
              >
                <ChevronLeft size={22} strokeWidth={1.25} />
              </button>
              <button
                type="button"
                onClick={() => setIndex((i) => Math.min(maxIndex, i + 1))}
                disabled={!canNext}
                aria-label="Sonraki ürünler"
                aria-disabled={!canNext}
                className="flex h-6 w-6 items-center justify-center text-ink transition-opacity hover:opacity-60 disabled:opacity-50 disabled:hover:opacity-50"
              >
                <ChevronRight size={22} strokeWidth={1.25} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Masaustu: overflow-hidden sarmalayici icinde translateX ile kayan
          serit. Mobil: Release temasinin "Just arrived" carousel'i gibi
          snap-x kaydirmali tek-kart-buyuk gorunum (Ozel Koleksiyonlar
          bolumundeki teknikle ayni, bkz. app/(site)/page.tsx) - kart ekranin
          buyuk kismini kaplar, sagda bir sonrakinin kenari gorunur.
          scroll-px-4: scroll-snap-mandatory olmadan container'in kendi
          px-4'u snap noktasinda gormezden geliniyor - tarayici sayfa
          yuklenir yuklenmez ilk karti sol kenara "yapistirmak" icin
          otomatik 16px kaydiriyordu, sol bosluk gorunmez oluyordu. */}
      <div className="hidden overflow-hidden md:block">
        <div
          className="flex w-full transition-transform duration-500 ease-out"
          style={{
            gap: `${GAP_DESKTOP}px`,
            transform: `translateX(calc(-1 * ${index} * ${stepCss}))`
          }}
        >
          {products.map((p) => (
            <div key={p.productId} className="shrink-0" style={{ width: itemWidthCss }}>
              <ProductCard product={p} />
            </div>
          ))}
        </div>
      </div>

      <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 [scrollbar-width:none] md:hidden [&::-webkit-scrollbar]:hidden scroll-px-4">
        {products.map((p) => (
          <div key={p.productId} className="w-[75vw] shrink-0 snap-start">
            <ProductCard product={p} />
          </div>
        ))}
      </div>
    </>
  );
}
