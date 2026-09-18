"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import { FilterDrawer } from "@/components/filter-drawer";
import {
  EMPTY_FILTERS,
  STOCK_IN,
  countActiveFilters,
  writeCatalogFilters,
  type CatalogFacets,
  type CatalogFilters
} from "@/lib/catalog-filters";

// Release temasinin katalog sayfasindaki ust cubugu: tek satirda solda
// "Filtrele" butonu (soldan acilan filtre cekmecesi, bkz. filter-drawer.tsx), ortada "Showing X of Y products" sayaci, sagda
// siralama acilir menusu (bkz. RELEASE_TEMA_BIREBIR_UYUM_PLANI.md 2).
// Kucuk-kapital tipografi header'daki nav linkleriyle ayni token'i kullanir
// (text-[10px] / tracking-[1.4px]) - Release'in bu cubuk icin ayri bir
// olcumu alinmadi, site ici tutarlilik tercih edildi.

export type CatalogFilterCategory = { name: string; slug: string };

// Katalogda gercekten uygulanabilen siralamalar. "En yeniler" ayri bir secenek
// degil cunku getCatalogEntries zaten varsayilan olarak createdAt desc doner
// (bkz. lib/catalog.ts) - olmayan bir sort parametresi icat edilmedi.
export const CATALOG_SORTS = [
  { key: "", label: "Önerilen" },
  { key: "fiyat-artan", label: "Fiyat: Düşükten yükseğe" },
  { key: "fiyat-azalan", label: "Fiyat: Yüksekten düşüğe" },
  { key: "isim", label: "İsim: A-Z" }
] as const;

export type CatalogSortKey = (typeof CATALOG_SORTS)[number]["key"];

// release-main.myshopify.com'da hem "Filters" hem sort tetikleyicisi cerceveli
// birer buton (`.facets__button-filters`/`.custom-select__btn`): 1px duz
// `rgb(235,235,235)` kenarlik, `border-radius: 0.8rem`, ikon metnin saginda
// kucuk bir bosluklu (bkz. component-facets.css / component-custom-select.css,
// 13 Eylul 2026 canli CSS'ten olculdu). Bizde eskiden cercevesiz duz metin +
// ok linkiydi - o cerceveli "buton" hissi kayboluyordu, buraya cekildi.
const TRIGGER_CLASS =
  "flex items-center gap-2 rounded-[0.8rem] border border-line bg-cream px-5 py-3 text-[10px] font-normal uppercase tracking-[1.4px] text-ink transition hover:border-ink";
const ITEM_CLASS =
  "block w-full px-4 py-2 text-left text-[10px] uppercase tracking-[1.4px] text-ink/70 transition hover:bg-line/60 hover:text-ink";
const ITEM_ACTIVE_CLASS =
  "block w-full px-4 py-2 text-left text-[10px] uppercase tracking-[1.4px] text-clay transition hover:bg-line/60";

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.25"
      className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function Dropdown({
  label,
  align,
  children
}: {
  label: string;
  align: "left" | "right";
  children: (close: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Disari tiklaninca / Esc'e basilinca kapanir - mega menudeki gibi ayri bir
  // saydam katman (overlay) eklenmedi, cunku cubuk sayfa akisinin icinde.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        className={TRIGGER_CLASS}
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((v) => !v)}
      >
        {label}
        <Chevron open={open} />
      </button>
      {open && (
        <div
          className={`absolute top-full z-30 mt-3 max-h-80 w-56 overflow-y-auto border border-line bg-cream py-2 ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

export function CatalogToolbar({
  categories,
  activeCategory,
  activeSort,
  count,
  facets,
  filters
}: {
  categories: CatalogFilterCategory[];
  activeCategory: string | null;
  activeSort: string;
  count: number;
  facets: CatalogFacets;
  filters: CatalogFilters;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Mevcut sorgu parametrelerini koruyarak tek bir parametreyi degistirir -
  // cinsiyet filtresi (mega menuden gelen) siralama secilince kaybolmasin diye.
  const applyParam = (key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  };

  // Filtre cekmecesi/cipleri: kategori + tum filtre param'larini birlikte yazar,
  // cinsiyet/sirala olduklari gibi kalir.
  const applyFilters = (next: CatalogFilters, category: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    writeCatalogFilters(params, next);
    if (category) params.set("kategori", category);
    else params.delete("kategori");
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    triggerRef.current?.focus();
  };

  const activeSortLabel =
    CATALOG_SORTS.find((s) => s.key === activeSort)?.label ?? CATALOG_SORTS[0].label;

  const activeFilterCount = countActiveFilters(filters, activeCategory !== null);
  const categoryName = categories.find((c) => c.slug === activeCategory)?.name ?? activeCategory;

  // Secili filtrelerin kaldirilabilir cipleri - her biri tek bir filtreyi
  // cikarip kalanlari korur.
  const chips: { key: string; label: string; remove: () => void }[] = [];
  if (activeCategory) {
    chips.push({ key: "kategori", label: categoryName ?? "", remove: () => applyFilters(filters, null) });
  }
  filters.colors.forEach((c) =>
    chips.push({
      key: `renk-${c}`,
      label: c,
      remove: () => applyFilters({ ...filters, colors: filters.colors.filter((v) => v !== c) }, activeCategory)
    })
  );
  filters.sizes.forEach((s) =>
    chips.push({
      key: `beden-${s}`,
      label: `Beden: ${s}`,
      remove: () => applyFilters({ ...filters, sizes: filters.sizes.filter((v) => v !== s) }, activeCategory)
    })
  );
  if (filters.minPrice !== null || filters.maxPrice !== null) {
    const min = filters.minPrice !== null ? `${filters.minPrice} TL` : "";
    const max = filters.maxPrice !== null ? `${filters.maxPrice} TL` : "";
    chips.push({
      key: "fiyat",
      label: filters.minPrice !== null && filters.maxPrice !== null ? `${min} – ${max}` : filters.minPrice !== null ? `${min} ve üzeri` : `${max} ve altı`,
      remove: () => applyFilters({ ...filters, minPrice: null, maxPrice: null }, activeCategory)
    });
  }
  if (filters.stock.length === 1) {
    chips.push({
      key: "stok",
      label: filters.stock[0] === STOCK_IN ? "Stokta" : "Stokta yok",
      remove: () => applyFilters({ ...filters, stock: [] }, activeCategory)
    });
  }
  if (filters.onSale) {
    chips.push({ key: "indirimli", label: "İndirimli", remove: () => applyFilters({ ...filters, onSale: false }, activeCategory) });
  }

  // Release'de cubugun kendi bir ust/alt cizgisi yok - ayrim artik butonlarin
  // kendi cercevesinden geliyor (bkz. TRIGGER_CLASS), disaridaki border-y
  // cift cerceve gibi durup gereksiz agirlasiyordu, kaldirildi.
  return (
    <>
    <div className="flex items-center justify-between gap-4 py-4">
      <button
        ref={triggerRef}
        type="button"
        className={TRIGGER_CLASS}
        aria-haspopup="dialog"
        aria-expanded={drawerOpen}
        onClick={() => setDrawerOpen(true)}
      >
        Filtrele
        {activeFilterCount > 0 && (
          <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-ink px-1 text-[9px] leading-none tracking-normal text-cream">
            {activeFilterCount}
          </span>
        )}
      </button>
      <FilterDrawer
        open={drawerOpen}
        onClose={closeDrawer}
        facets={facets}
        categories={categories}
        activeCategory={activeCategory}
        applied={filters}
        onApply={(next, category) => {
          applyFilters(next, category);
          closeDrawer();
        }}
      />

      {/* Release'de burada "Showing X of Y products" yazar - orada sayfalama
          oldugu icin X ile Y farklidir. Bollmark katalogu tek sayfada tum
          sonuclari gosterdigi icin iki sayi hep esit olurdu; uydurma bir
          "X of Y" yerine gercek sonuc sayisi yaziliyor. */}
      <p className="text-[10px] uppercase tracking-[1.4px] text-ink/50">{count} ürün</p>

      <Dropdown label={activeSortLabel} align="right">
        {(close) => (
          <>
            {CATALOG_SORTS.map((sort) => (
              <button
                key={sort.key || "varsayilan"}
                type="button"
                className={activeSort === sort.key ? ITEM_ACTIVE_CLASS : ITEM_CLASS}
                onClick={() => {
                  applyParam("sirala", sort.key || null);
                  close();
                }}
              >
                {sort.label}
              </button>
            ))}
          </>
        )}
      </Dropdown>
    </div>

    {chips.length > 0 && (
      <ul className="flex flex-wrap items-center gap-2 pb-4">
        {chips.map((chip) => (
          <li key={chip.key}>
            <button
              type="button"
              aria-label={`${chip.label} filtresini kaldır`}
              onClick={chip.remove}
              className="flex h-8 items-center gap-2 border border-line px-3 text-[10px] uppercase tracking-[1.4px] text-ink transition hover:border-ink"
            >
              {chip.label}
              <X size={12} strokeWidth={1.5} />
            </button>
          </li>
        ))}
        {chips.length > 1 && (
          <li>
            <button
              type="button"
              onClick={() => applyFilters(EMPTY_FILTERS, null)}
              className="px-2 text-[10px] uppercase tracking-[1.4px] text-ink underline underline-offset-4"
            >
              Tümünü temizle
            </button>
          </li>
        )}
      </ul>
    )}
    </>
  );
}
