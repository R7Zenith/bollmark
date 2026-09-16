"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ProductCard, type ProductCardData } from "@/components/product-card";

// Masaustunde ayni anda 4 kart gorunur (Shopify Release "just arrived"
// slider'i referansi) - bir oka basinca TEK bir urun genisligi kadar kayar,
// 4'erli sayfalama yapmaz. Ucta sonsuz donguye girmez, ok disabled olur.
const VISIBLE_DESKTOP = 4;

export function FeaturedCarousel({ products }: { products: ProductCardData[] }) {
  const total = products.length;
  const maxIndex = Math.max(0, total - VISIBLE_DESKTOP);
  const [index, setIndex] = useState(0);

  const canPrev = index > 0;
  const canNext = index < maxIndex;

  return (
    <>
      <div className="mb-12 flex items-end justify-between">
        <h2 className="font-display text-4xl font-medium tracking-tight">Yeni Gelenler</h2>
        <div className="flex items-center gap-6">
          {total > VISIBLE_DESKTOP && (
            <div className="hidden items-center gap-2 md:flex">
              <button
                type="button"
                onClick={() => setIndex((i) => Math.max(0, i - 1))}
                disabled={!canPrev}
                aria-label="Önceki ürünler"
                aria-disabled={!canPrev}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-ink/15 text-ink transition hover:border-ink/40 disabled:opacity-30 disabled:hover:border-ink/15"
              >
                <ChevronLeft size={18} />
              </button>
              <button
                type="button"
                onClick={() => setIndex((i) => Math.min(maxIndex, i + 1))}
                disabled={!canNext}
                aria-label="Sonraki ürünler"
                aria-disabled={!canNext}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-ink/15 text-ink transition hover:border-ink/40 disabled:opacity-30 disabled:hover:border-ink/15"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          )}
          <Link href="/urunler" className="text-sm uppercase tracking-wide hover:text-clay">
            Tümünü Gör →
          </Link>
        </div>
      </div>

      {/* Masaustu: overflow-hidden sarmalayici icinde translateX ile kayan
          serit. Kart arasi bosluk katalog sayfasindaki grid'in md:gap-6'siyla
          (24px) birebir eslessin diye her karta px-3 (12px) veriliyor.
          Mobil: carousel etkilesimi yerine dogal dikey scroll ile katalogun
          mobil grid'iyle (kenara yaslanmis, -mx-4 gap-x-0.5) birebir ayni
          2 sutunlu sabit grid'e geri dusuluyor. */}
      <div className="hidden overflow-hidden md:block">
        <div
          className="-mx-3 flex transition-transform duration-500 ease-out"
          style={{
            width: `${(total / VISIBLE_DESKTOP) * 100}%`,
            transform: `translateX(-${index * (100 / total)}%)`
          }}
        >
          {products.map((p) => (
            <div key={p.productId} className="shrink-0 px-3" style={{ width: `${100 / total}%` }}>
              <ProductCard product={p} />
            </div>
          ))}
        </div>
      </div>

      <div className="-mx-4 grid grid-cols-2 gap-x-0.5 gap-y-3 md:hidden">
        {products.map((p) => (
          <ProductCard key={p.productId} product={p} />
        ))}
      </div>
    </>
  );
}
