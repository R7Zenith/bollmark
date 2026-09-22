"use client";

import Link from "next/link";
import { useRef, useState, type KeyboardEvent } from "react";
import { ProductCard, type ProductCardData } from "@/components/product-card";

export type BestsellerTab = { key: string; label: string; products: ProductCardData[] };

// Cok Satanlar: veri sunucuda hazirlanir (bkz. app/(site)/page.tsx), sekme
// degisimi yalniz istemcide - fetch yok. Sekmeler WAI-ARIA tablist deseniyle:
// aktif sekme tabIndex=0, oklar/Home/End sekme degistirir. Tek sekme varsa
// (yalniz "Tumu") sekme cubugu hic gosterilmez. Kart izgarasi mobilde
// Release'in "Just arrived" carousel'i gibi snap-x kaydirmali tek-kart-buyuk
// (Ozel Koleksiyonlar bolumundeki teknikle ayni), masaustunde 4 sutun.
export function BestsellersTabs({ tabs }: { tabs: BestsellerTab[] }) {
  const [activeKey, setActiveKey] = useState(tabs[0]?.key);
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const active = tabs.find((t) => t.key === activeKey) ?? tabs[0];
  if (!active) return null;

  function selectTab(key: string) {
    setActiveKey(key);
    if (scrollRef.current) scrollRef.current.scrollLeft = 0;
  }

  function focusTab(key: string) {
    selectTab(key);
    tabRefs.current[key]?.focus();
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const i = tabs.findIndex((t) => t.key === active.key);
    if (e.key === "ArrowRight") focusTab(tabs[(i + 1) % tabs.length].key);
    else if (e.key === "ArrowLeft") focusTab(tabs[(i - 1 + tabs.length) % tabs.length].key);
    else if (e.key === "Home") focusTab(tabs[0].key);
    else if (e.key === "End") focusTab(tabs[tabs.length - 1].key);
    else return;
    e.preventDefault();
  }

  return (
    <>
      <div className="mb-6 flex items-end justify-between md:mb-8">
        <h2 className="font-display text-3xl font-normal tracking-[-0.04em] md:text-5xl">Çok Satanlar</h2>
        <Link
          href="/urunler"
          className="link-shrink-underline text-[10px] font-medium uppercase tracking-[0.1em] text-ink"
        >
          Tümünü Gör
        </Link>
      </div>

      {tabs.length > 1 && (
        <div role="tablist" aria-label="Çok satanlar" onKeyDown={onKeyDown} className="mb-8 flex gap-6 md:mb-10">
          {tabs.map((t) => {
            const selected = t.key === active.key;
            return (
              <button
                key={t.key}
                ref={(el) => {
                  tabRefs.current[t.key] = el;
                }}
                type="button"
                role="tab"
                id={`bestsellers-tab-${t.key}`}
                aria-selected={selected}
                aria-controls="bestsellers-panel"
                tabIndex={selected ? 0 : -1}
                onClick={() => selectTab(t.key)}
                className={`border-b pb-1 text-[10px] font-medium uppercase tracking-[0.1em] transition-colors ${
                  selected ? "border-ink text-ink" : "border-transparent text-ink/50 hover:text-ink"
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      )}

      <div
        ref={scrollRef}
        role="tabpanel"
        id="bestsellers-panel"
        aria-labelledby={tabs.length > 1 ? `bestsellers-tab-${active.key}` : undefined}
        className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 [scrollbar-width:none] md:mx-0 md:grid md:grid-cols-4 md:gap-6 md:overflow-visible md:px-0 [&::-webkit-scrollbar]:hidden scroll-px-4"
      >
        {active.products.map((p) => (
          <div key={p.productId} className="w-[75vw] shrink-0 snap-start md:w-auto">
            <ProductCard product={p} />
          </div>
        ))}
      </div>
    </>
  );
}
