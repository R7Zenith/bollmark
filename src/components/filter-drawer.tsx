"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, X } from "lucide-react";
import {
  EMPTY_FILTERS,
  STOCK_IN,
  STOCK_OUT,
  type CatalogFacets,
  type CatalogFilters
} from "@/lib/catalog-filters";

// Sepet cekmecesiyle (cart-drawer.tsx) ayni mount/visible iki asamali pattern,
// ayni 450ms + cubic-bezier easing, ayni overlay/z-index - yalnizca soldan
// gelir. Secimler cekmece icinde gecici (draft) tutulur, "Filtreleri Uygula"
// ile URL'ye yazilir (bkz. catalog-toolbar.tsx onApply).
// Animasyonlar prefers-reduced-motion a bakmaz - kullanici istegiyle her zaman
// oynar (globals.css taki ticker notuyla ayni tercih).

export type FilterDrawerCategory = { name: string; slug: string };

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';
const INITIAL_COLOR_COUNT = 5;

function Checkbox({
  checked,
  onChange,
  children
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3 py-2">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="peer sr-only"
      />
      <span
        className={`flex h-4 w-4 shrink-0 items-center justify-center border border-ink transition duration-300 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ink ${
          checked ? "bg-ink text-cream" : "bg-cream"
        }`}
      >
        {checked && <Check size={12} strokeWidth={2} />}
      </span>
      {children}
    </label>
  );
}

function Label({ children, count }: { children: React.ReactNode; count?: number }) {
  return (
    <span className="flex items-center gap-2 text-[11px] uppercase tracking-[1.4px] text-ink">
      {children}
      {count !== undefined && <span className="text-ink/40">({count})</span>}
    </span>
  );
}

// Yukseklik animasyonu icin grid-template-rows 0fr -> 1fr; kapaliyken icerik
// `inert` oldugu icin klavye/ekran okuyucu odagina girmez.
function Collapse({ open, children }: { open: boolean; children: React.ReactNode }) {
  return (
    <div
      className={`grid transition-[grid-template-rows] duration-300 ease-out ${
        open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
      }`}
    >
      <div className="overflow-hidden" inert={!open}>
        {children}
      </div>
    </div>
  );
}

function Section({
  id,
  title,
  defaultOpen = true,
  children
}: {
  id: string;
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="border-b border-line">
      <h3>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={`filter-${id}`}
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center justify-between py-5 text-left text-[12px] uppercase tracking-[1.4px] text-ink"
        >
          {title}
          <ChevronDown
            size={16}
            strokeWidth={1.25}
            className={`shrink-0 transition-transform duration-300 ${open ? "rotate-180" : ""}`}
          />
        </button>
      </h3>
      <div id={`filter-${id}`}>
        <Collapse open={open}>
          <div className="pb-5">{children}</div>
        </Collapse>
      </div>
    </section>
  );
}

function toggle(list: string[], value: string, on: boolean): string[] {
  return on ? [...list.filter((v) => v !== value), value] : list.filter((v) => v !== value);
}

function DrawerPanel({
  facets,
  categories,
  activeCategory,
  applied,
  visible,
  onApply,
  onClose
}: {
  facets: CatalogFacets;
  categories: FilterDrawerCategory[];
  activeCategory: string | null;
  applied: CatalogFilters;
  visible: boolean;
  onApply: (filters: CatalogFilters, category: string | null) => void;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [draft, setDraft] = useState<CatalogFilters>(applied);
  const [category, setCategory] = useState<string | null>(activeCategory);
  const [minText, setMinText] = useState(applied.minPrice !== null ? String(applied.minPrice) : "");
  const [maxText, setMaxText] = useState(applied.maxPrice !== null ? String(applied.maxPrice) : "");
  const [showAllColors, setShowAllColors] = useState(false);

  // Panel gorunur olunca odak kapat butonuna gecer. Kisa bir gecikmeyle:
  // visibility gecisi basladigi anda (hatta sonraki frame'de bile) panel hala
  // visibility:hidden oldugu icin hemen focus() sessizce basarisiz olur.
  useEffect(() => {
    if (!visible) return;
    const timeout = setTimeout(() => closeRef.current?.focus(), 60);
    return () => clearTimeout(timeout);
  }, [visible]);

  // Esc kapatir, Tab panel icinde doner (focus trap). Odak panel disinda
  // (ornegin bosluga tiklaninca body'de) kalsa da calissin diye document'ta.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;
      const items = [...panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        (el) => !el.closest("[inert]")
      );
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (!panelRef.current.contains(active)) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const parsePriceText = (text: string) => {
    const n = Number(text);
    return text.trim() !== "" && Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
  };

  const apply = () => {
    let minPrice = parsePriceText(minText);
    let maxPrice = parsePriceText(maxText);
    if (minPrice !== null && maxPrice !== null && minPrice > maxPrice) [minPrice, maxPrice] = [maxPrice, minPrice];
    onApply({ ...draft, minPrice, maxPrice }, category);
  };

  const clear = () => {
    setDraft(EMPTY_FILTERS);
    setCategory(null);
    setMinText("");
    setMaxText("");
  };

  const visibleColors = facets.colors.slice(0, INITIAL_COLOR_COUNT);
  const extraColors = facets.colors.slice(INITIAL_COLOR_COUNT);

  const colorOption = (color: CatalogFacets["colors"][number]) => (
    <Checkbox
      key={color.name}
      checked={draft.colors.includes(color.name)}
      onChange={(on) => setDraft((d) => ({ ...d, colors: toggle(d.colors, color.name, on) }))}
    >
      {color.hex && (
        <span
          aria-hidden="true"
          className="h-4 w-4 shrink-0 border border-line"
          style={{ backgroundColor: color.hex }}
        />
      )}
      <Label count={color.count}>{color.name}</Label>
    </Checkbox>
  );

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-label="Filtrele"
      className={`absolute inset-y-0 left-0 z-[801] flex h-full w-full max-w-full flex-col bg-cream transition-[transform,visibility] duration-[450ms] ease-[cubic-bezier(0.74,-0.01,0.26,1)] sm:w-[26rem] lg:w-[30rem] ${
        visible ? "visible translate-x-0" : "invisible -translate-x-full"
      }`}
    >
      <div className="flex justify-end px-6 pt-5">
        <button ref={closeRef} type="button" aria-label="Kapat" onClick={onClose} className="p-1">
          <X size={20} strokeWidth={1.5} />
        </button>
      </div>
      <p className="px-6 pb-4 text-[36px] font-normal leading-[36px] tracking-[-1.44px]">Filtrele</p>

      <div className="flex-1 overflow-y-auto border-t border-line px-6">
        {categories.length > 0 && (
          <Section id="kategori" title="Kategori" defaultOpen={activeCategory !== null}>
            {categories.map((c) => (
              <Checkbox key={c.slug} checked={category === c.slug} onChange={(on) => setCategory(on ? c.slug : null)}>
                <Label>{c.name}</Label>
              </Checkbox>
            ))}
          </Section>
        )}

        {facets.colors.length > 0 && (
          <Section id="renk" title="Renk">
            {visibleColors.map(colorOption)}
            {extraColors.length > 0 && (
              <>
                <Collapse open={showAllColors}>{extraColors.map(colorOption)}</Collapse>
                <button
                  type="button"
                  aria-expanded={showAllColors}
                  onClick={() => setShowAllColors((v) => !v)}
                  className="mt-2 text-[11px] uppercase tracking-[1.4px] text-ink underline underline-offset-4"
                >
                  {showAllColors ? "Daha az göster" : "Daha fazla göster"}
                </button>
              </>
            )}
          </Section>
        )}

        {facets.sizes.length > 0 && (
          <Section id="beden" title="Beden">
            <div className="flex flex-wrap gap-2">
              {facets.sizes.map((size) => {
                const selected = draft.sizes.includes(size.name);
                return (
                  <button
                    key={size.name}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setDraft((d) => ({ ...d, sizes: toggle(d.sizes, size.name, !selected) }))}
                    className={`flex h-9 min-w-[44px] items-center justify-center rounded-none border border-ink px-3 text-[11px] uppercase leading-none tracking-[1px] transition duration-300 ${
                      selected ? "bg-ink text-cream" : "bg-cream text-ink hover:bg-ink hover:text-cream"
                    }`}
                  >
                    {size.name}
                  </button>
                );
              })}
            </div>
          </Section>
        )}

        {facets.priceRange && (
          <Section id="fiyat" title="Fiyat">
            <div className="flex items-center gap-3">
              <PriceInput label="En düşük fiyat" value={minText} onChange={setMinText} placeholder={facets.priceRange.min} />
              <span aria-hidden="true" className="text-ink/40">–</span>
              <PriceInput label="En yüksek fiyat" value={maxText} onChange={setMaxText} placeholder={facets.priceRange.max} />
            </div>
          </Section>
        )}

        <Section id="stok" title="Stok Durumu">
          <Checkbox checked={draft.stock.includes(STOCK_IN)} onChange={(on) => setDraft((d) => ({ ...d, stock: toggle(d.stock, STOCK_IN, on) }))}>
            <Label count={facets.inStockCount}>Stokta</Label>
          </Checkbox>
          <Checkbox checked={draft.stock.includes(STOCK_OUT)} onChange={(on) => setDraft((d) => ({ ...d, stock: toggle(d.stock, STOCK_OUT, on) }))}>
            <Label count={facets.outOfStockCount}>Stokta yok</Label>
          </Checkbox>
        </Section>

        {facets.onSaleCount > 0 && (
          <Section id="indirim" title="İndirimli Ürünler">
            <Checkbox checked={draft.onSale} onChange={(on) => setDraft((d) => ({ ...d, onSale: on }))}>
              <Label count={facets.onSaleCount}>Sadece indirimli ürünler</Label>
            </Checkbox>
          </Section>
        )}
      </div>

      <div className="flex gap-3 border-t border-line px-6 py-5">
        <button
          type="button"
          onClick={clear}
          className="flex h-[44px] flex-1 items-center justify-center rounded-[50px] border border-ink bg-cream text-[10px] uppercase tracking-[1px] text-ink transition duration-300 hover:bg-ink hover:text-cream"
        >
          Temizle
        </button>
        <button
          type="button"
          onClick={apply}
          className="flex h-[44px] flex-1 items-center justify-center rounded-[50px] border border-ink bg-ink text-[10px] uppercase tracking-[1px] text-cream transition duration-300 hover:bg-transparent hover:text-ink"
        >
          Filtreleri Uygula
        </button>
      </div>
    </div>
  );
}

function PriceInput({
  label,
  value,
  onChange,
  placeholder
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: number;
}) {
  return (
    <label className="flex h-11 flex-1 items-center gap-2 border border-line px-3 focus-within:border-ink">
      <span className="sr-only">{label}</span>
      <input
        type="number"
        inputMode="numeric"
        min={0}
        value={value}
        placeholder={String(placeholder)}
        onChange={(e) => onChange(e.target.value)}
        className="w-full min-w-0 bg-transparent text-[12px] tracking-[1px] text-ink outline-none placeholder:text-ink/30"
      />
      <span aria-hidden="true" className="text-[10px] uppercase tracking-[1px] text-ink/50">TL</span>
    </label>
  );
}

export function FilterDrawer({
  open,
  onClose,
  ...panelProps
}: {
  open: boolean;
  onClose: () => void;
  facets: CatalogFacets;
  categories: FilterDrawerCategory[];
  activeCategory: string | null;
  applied: CatalogFilters;
  onApply: (filters: CatalogFilters, category: string | null) => void;
}) {
  // `rendered`: cekmece DOM'da mi (kapanis animasyonu bitene kadar true kalir),
  // `entered`: acilis icin bir sonraki frame gecti mi - transform transition'i
  // oynasin diye panel ilk once kapali konumda mount olur. Cekmece yalnizca
  // tiklamayla acildigi icin SSR/document kontrolu gerekmiyor.
  const [rendered, setRendered] = useState(false);
  const [entered, setEntered] = useState(false);
  if (open && !rendered) setRendered(true);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    const raf = requestAnimationFrame(() => setEntered(true));
    return () => {
      cancelAnimationFrame(raf);
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    if (open || !rendered) return;
    const timeout = setTimeout(() => {
      setRendered(false);
      setEntered(false);
    }, 450);
    return () => clearTimeout(timeout);
  }, [open, rendered]);

  if (!rendered) return null;
  const visible = open && entered;

  // DrawerPanel her acilista yeniden mount olur (kapanista rendered false
  // olunca unmount), bu yuzden draft state'i her seferinde uygulanmis
  // filtrelerden basliyor.
  return createPortal(
    <div className="fixed inset-0 z-[800]">
      <button
        type="button"
        aria-label="Filtreyi kapat"
        tabIndex={-1}
        className={`absolute inset-0 bg-black/50 ${visible ? "" : "invisible"}`}
        onClick={onClose}
      />
      <DrawerPanel {...panelProps} visible={visible} onClose={onClose} />
    </div>,
    document.body
  );
}
