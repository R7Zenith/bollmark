"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { formatPrice } from "@/lib/format";
import { SEARCH_MAX_LENGTH, SEARCH_MIN_LENGTH, highlightRanges, normalizeTr } from "@/lib/search-text";
import type { SearchResult } from "@/app/(site)/api/arama/route";

export type SearchChip = { label: string; href: string };

type SearchResponse = { results: SearchResult[]; total: number };

const RECENT_KEY = "bollmark:recent-searches";
const RECENT_LIMIT = 5;
const DEBOUNCE_MS = 200;
// Kapanis gecisinin suresi - bitince panel DOM'dan kalkar (MobileMenu deseni).
const CLOSE_MS = 200;

function readRecent(): string[] {
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === "string").slice(0, RECENT_LIMIT) : [];
  } catch {
    return [];
  }
}

function writeRecent(list: string[]) {
  try {
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(list));
  } catch {
    // Gizli sekme / engelli depolama - son aramalar sadece bu oturumda kalir.
  }
}

function searchHref(q: string) {
  return `/urunler?ara=${encodeURIComponent(q)}`;
}

function Highlight({ text, query }: { text: string; query: string }) {
  const ranges = highlightRanges(text, query);
  if (ranges.length === 0) return <>{text}</>;
  const parts: React.ReactNode[] = [];
  let last = 0;
  for (const [start, end] of ranges) {
    if (start > last) parts.push(text.slice(last, start));
    parts.push(
      <span key={start} className="font-semibold">
        {text.slice(start, end)}
      </span>
    );
    last = end;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}

function SearchGlyph({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function CrossGlyph({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <line x1="6" y1="6" x2="18" y2="18" />
      <line x1="18" y1="6" x2="6" y2="18" />
    </svg>
  );
}

const SECTION_HEADING_CLASS = "mb-3 text-sm font-semibold tracking-[0.28px] text-ink";
const FOCUS_CLASS = "focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-ink";

function Chips({ chips, onPick }: { chips: SearchChip[]; onPick: () => void }) {
  if (chips.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-2">
      {chips.map((chip) => (
        <li key={chip.href}>
          <Link
            href={chip.href}
            onClick={onPick}
            className={`flex h-11 items-center rounded-[50px] border border-line px-4 text-xs tracking-[0.3px] text-ink transition-colors hover:border-ink xl:h-9 ${FOCUS_CLASS}`}
          >
            {chip.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}

// Sonuc satiri/karti: mobilde solda kucuk gorselli dikey liste, masaustunde
// (xl) 4 sutunlu mini kart - ayni isaretleme, siniflar genislige gore degisir.
const ITEM_CLASS = "flex gap-4 border-b border-line py-3 xl:block xl:border-0 xl:py-0";
// Masaustunde kartlar "mini" kalsin (panel ekrani kaplamasin) diye grid
// genisligi sinirli; 1440px'te gorsel ~240px.
const RESULTS_GRID_CLASS = "xl:grid xl:max-w-[1040px] xl:grid-cols-4 xl:gap-6";
const IMAGE_WRAP_CLASS ="relative h-[85px] w-16 shrink-0 overflow-hidden xl:aspect-[3/4] xl:h-auto xl:w-full";

function SkeletonList() {
  return (
    <ul className={RESULTS_GRID_CLASS} aria-hidden="true">
      {Array.from({ length: 4 }, (_, i) => (
        <li key={i} className={ITEM_CLASS}>
          <div className={`${IMAGE_WRAP_CLASS} animate-pulse bg-line motion-reduce:animate-none`} />
          <div className="flex flex-1 flex-col gap-2 pt-1 xl:mt-3 xl:pt-0">
            <div className="h-2.5 w-16 bg-line" />
            <div className="h-3 w-3/4 bg-line" />
            <div className="h-3 w-12 bg-line" />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function SearchOverlay({
  open,
  onClose,
  chips
}: {
  open: boolean;
  onClose: () => void;
  chips: SearchChip[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [mounted, setMounted] = useState(false);
  // MobileMenu'daki desenle ayni: shouldRender DOM'da tutar, visible bir
  // sonraki karede true'ya cekilerek gercek bir "kapali -> acik" gecisi olusur.
  const [shouldRender, setShouldRender] = useState(false);
  const [visible, setVisible] = useState(false);
  const [query, setQuery] = useState("");
  const [data, setData] = useState<{ key: string; response: SearchResponse } | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [recent, setRecent] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const cacheRef = useRef(new Map<string, SearchResponse>());
  const returnFocusRef = useRef<HTMLElement | null>(null);

  const trimmed = query.trim().slice(0, SEARCH_MAX_LENGTH);
  const key = normalizeTr(trimmed);
  const tooShort = trimmed.length > 0 && trimmed.length < SEARCH_MIN_LENGTH;
  const current = data && data.key === key ? data.response : null;
  // Yeni sorgunun cevabi gelene kadar onceki sonuclar soluk kalir (her tusta
  // iskelete donup zıplamasin); hic sonuc yokken iskelet gosterilir.
  const shown = current ?? (loading && data ? data.response : null);
  const results = trimmed.length >= SEARCH_MIN_LENGTH ? (shown?.results ?? []) : [];

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (open) {
      returnFocusRef.current = document.activeElement as HTMLElement | null;
      setRecent(readRecent());
      setShouldRender(true);
      document.body.style.overflow = "hidden";
    } else {
      setVisible(false);
      document.body.style.overflow = "";
      const timeout = setTimeout(() => {
        setShouldRender(false);
        setQuery("");
        setActiveIndex(-1);
      }, CLOSE_MS);
      returnFocusRef.current?.focus();
      returnFocusRef.current = null;
      return () => clearTimeout(timeout);
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    if (!shouldRender) return;
    const raf = requestAnimationFrame(() => {
      setVisible(true);
      inputRef.current?.focus();
    });
    return () => cancelAnimationFrame(raf);
  }, [shouldRender]);

  // Sayfa degisince (sonuca/chip'e tiklama, Enter) panel kapanir.
  const routeKey = `${pathname}?${searchParams.toString()}`;
  const routeKeyRef = useRef(routeKey);
  useEffect(() => {
    if (routeKeyRef.current === routeKey) return;
    routeKeyRef.current = routeKey;
    if (open) onClose();
  }, [routeKey, open, onClose]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    setActiveIndex(-1);
    setFailed(false);
    if (trimmed.length < SEARCH_MIN_LENGTH) {
      setLoading(false);
      return;
    }
    const cached = cacheRef.current.get(key);
    if (cached) {
      setData({ key, response: cached });
      setLoading(false);
      return;
    }
    setLoading(true);
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/arama?q=${encodeURIComponent(trimmed)}`, { signal: controller.signal });
        if (!res.ok) throw new Error(String(res.status));
        const response = (await res.json()) as SearchResponse;
        cacheRef.current.set(key, response);
        setData({ key, response });
        setLoading(false);
      } catch (err) {
        if (controller.signal.aborted) return;
        console.error("Arama başarısız:", err);
        setFailed(true);
        setLoading(false);
      }
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
    // key trimmed'den turetiliyor; ikisi birlikte degisir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (!shouldRender || !mounted) return null;

  const remember = (q: string) => {
    const value = q.trim();
    if (value.length < SEARCH_MIN_LENGTH) return;
    const norm = normalizeTr(value);
    const next = [value, ...recent.filter((r) => normalizeTr(r) !== norm)].slice(0, RECENT_LIMIT);
    setRecent(next);
    writeRecent(next);
  };

  const removeRecent = (q: string) => {
    const next = recent.filter((r) => r !== q);
    setRecent(next);
    writeRecent(next);
  };

  const clearRecent = () => {
    setRecent([]);
    writeRecent([]);
  };

  const go = (href: string) => {
    remember(trimmed);
    onClose();
    router.push(href);
  };

  const onInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" && results.length > 0) {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % results.length);
    } else if (e.key === "ArrowUp" && results.length > 0) {
      e.preventDefault();
      setActiveIndex((i) => (i <= 0 ? results.length - 1 : i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIndex >= 0 && results[activeIndex]) go(results[activeIndex].href);
      else if (trimmed.length >= SEARCH_MIN_LENGTH) go(searchHref(trimmed));
    }
  };

  const showEmptyState = trimmed.length === 0;
  const showSkeleton = trimmed.length >= SEARCH_MIN_LENGTH && !shown && !failed;
  const showNoResults = !!current && current.total === 0;

  // Header'daki backdrop-blur fixed konumlanmayi header'a hapsettigi icin
  // (MobileMenu'daki ayni gerekce) panel body'ye portal ile tasinir. Masaustunde
  // header'in altindan baslar (header ve X'e donen arama ikonu gorunur kalir),
  // mobilde tam ekrandir ve kendi "Vazgec" butonu vardir.
  return createPortal(
    <div className="fixed inset-0 z-50 xl:top-[72px]">
      <button
        type="button"
        aria-label="Aramayı kapat"
        tabIndex={-1}
        onClick={onClose}
        className={`absolute inset-0 bg-ink/40 transition-opacity duration-200 motion-reduce:transition-none ${
          visible ? "opacity-100" : "opacity-0"
        }`}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Ürün ara"
        className={`absolute inset-0 flex h-[100dvh] flex-col bg-cream transition-[opacity,transform] motion-reduce:transition-none xl:bottom-auto xl:h-auto xl:max-h-[calc(100dvh-72px)] xl:border-b xl:border-line ${
          visible
            ? "translate-y-0 scale-100 opacity-100 duration-[260ms] ease-out"
            : "scale-[0.98] opacity-0 duration-200 ease-in xl:-translate-y-2 xl:scale-100"
        }`}
      >
        <div className="flex items-center gap-3 px-4 pt-3 xl:px-9 xl:pt-8">
          <div className="relative flex-1">
            <SearchGlyph className="pointer-events-none absolute left-0 top-1/2 h-5 w-5 -translate-y-1/2 xl:h-6 xl:w-6" />
            <input
              ref={inputRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onInputKeyDown}
              maxLength={SEARCH_MAX_LENGTH}
              placeholder="Ürün, marka veya ürün kodu ara"
              inputMode="search"
              enterKeyHint="search"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              role="combobox"
              aria-expanded={results.length > 0}
              aria-controls="site-search-results"
              aria-autocomplete="list"
              aria-activedescendant={activeIndex >= 0 ? `site-search-option-${activeIndex}` : undefined}
              className="h-12 w-full rounded-none border-b border-ink bg-transparent pl-8 pr-10 text-base font-normal tracking-[-0.3px] text-ink outline-none placeholder:text-ink/40 xl:h-16 xl:pl-10 xl:text-2xl xl:tracking-[-0.6px] [&::-webkit-search-cancel-button]:appearance-none"
            />
            {query && (
              <button
                type="button"
                aria-label="Aramayı temizle"
                onClick={() => {
                  setQuery("");
                  inputRef.current?.focus();
                }}
                className={`absolute right-0 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center text-ink/60 hover:text-ink ${FOCUS_CLASS}`}
              >
                <CrossGlyph className="h-4 w-4" />
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`h-11 shrink-0 text-xs tracking-[0.3px] text-ink xl:hidden ${FOCUS_CLASS}`}
          >
            Vazgeç
          </button>
          <button
            type="button"
            aria-label="Aramayı kapat"
            onClick={onClose}
            className={`hidden h-11 w-11 shrink-0 items-center justify-center hover:text-clay xl:flex ${FOCUS_CLASS}`}
          >
            <CrossGlyph className="h-6 w-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-8 pt-5 xl:px-9 xl:pb-10 xl:pt-8">
          {showEmptyState && (
            <div className="space-y-8 xl:grid xl:grid-cols-2 xl:gap-12 xl:space-y-0">
              {recent.length > 0 && (
                <section>
                  <div className="flex items-baseline justify-between">
                    <h2 className={SECTION_HEADING_CLASS}>Son aramalar</h2>
                    <button
                      type="button"
                      onClick={clearRecent}
                      className={`text-xs text-ink/60 underline underline-offset-2 hover:text-ink ${FOCUS_CLASS}`}
                    >
                      Temizle
                    </button>
                  </div>
                  <ul>
                    {recent.map((r) => (
                      <li key={r} className="flex items-center justify-between border-b border-line">
                        <button
                          type="button"
                          onClick={() => setQuery(r)}
                          className={`flex h-11 flex-1 items-center text-left text-sm text-ink hover:text-ink/70 ${FOCUS_CLASS}`}
                        >
                          {r}
                        </button>
                        <button
                          type="button"
                          aria-label={`"${r}" aramasını sil`}
                          onClick={() => removeRecent(r)}
                          className={`flex h-11 w-11 items-center justify-center text-ink/50 hover:text-ink ${FOCUS_CLASS}`}
                        >
                          <CrossGlyph className="h-3.5 w-3.5" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              {chips.length > 0 && (
                <section>
                  <h2 className={SECTION_HEADING_CLASS}>Popüler kategoriler</h2>
                  <Chips chips={chips} onPick={onClose} />
                </section>
              )}
            </div>
          )}

          {tooShort && <p className="text-sm text-ink/60">En az 2 harf yazın.</p>}

          {failed && <p className="text-sm text-ink/60">Arama şu an yapılamıyor. Biraz sonra tekrar deneyin.</p>}

          {showSkeleton && <SkeletonList />}

          {showNoResults && (
            <div>
              <p className="text-base text-ink xl:text-lg">“{trimmed}” için sonuç bulunamadı.</p>
              <p className="mt-1 text-sm text-ink/60">Farklı bir kelime deneyin ya da kategorilere göz atın.</p>
              <div className="mt-6">
                <Chips chips={chips} onPick={onClose} />
              </div>
            </div>
          )}

          {results.length > 0 && (
            <>
              <ul
                key={data?.key}
                id="site-search-results"
                role="listbox"
                aria-label="Arama sonuçları"
                className={`transition-opacity duration-150 ${RESULTS_GRID_CLASS} ${current ? "" : "opacity-60"}`}
              >
                {results.map((result, index) => (
                  <li
                    key={result.href}
                    id={`site-search-option-${index}`}
                    role="option"
                    aria-selected={index === activeIndex}
                    className="animate-search-in motion-reduce:animate-none"
                    style={{ animationDelay: `${index * 40}ms` }}
                  >
                    <Link
                      href={result.href}
                      tabIndex={-1}
                      onClick={() => {
                        remember(trimmed);
                        onClose();
                      }}
                      onMouseEnter={() => setActiveIndex(index)}
                      className={`${ITEM_CLASS} group outline-offset-4 ${index === activeIndex ? "outline outline-1 outline-ink" : ""}`}
                    >
                      <div className={`${IMAGE_WRAP_CLASS} ${result.greyBackdrop ? "bg-image-bg" : "bg-line"}`}>
                        {result.image && (
                          <Image
                            src={result.image}
                            alt=""
                            fill
                            sizes="(min-width: 1280px) 22vw, 64px"
                            className={`object-cover${result.greyBackdrop ? " mix-blend-multiply" : ""}`}
                          />
                        )}
                        {result.outOfStock && (
                          <span className="absolute bottom-1 left-1 bg-cream/90 px-1.5 py-0.5 text-[9px] uppercase tracking-[0.6px] text-ink/70 xl:bottom-2 xl:left-2 xl:text-[10px]">
                            Tükendi
                          </span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1 xl:mt-3">
                        {result.brand && (
                          <p className="text-[10px] uppercase tracking-[1px] text-ink/50">
                            <Highlight text={result.brand} query={trimmed} />
                          </p>
                        )}
                        <p className="mt-0.5 line-clamp-2 text-[12px] uppercase leading-[15px] tracking-[0.48px] text-ink">
                          <Highlight text={result.name} query={trimmed} />
                        </p>
                        {result.colorLabel && (
                          <p className="mt-0.5 text-[12px] leading-[15px] text-ink/50">
                            <Highlight text={result.colorLabel} query={trimmed} />
                          </p>
                        )}
                        <p className="mt-1 flex items-center gap-2 text-[12px] tracking-[0.48px]">
                          <span className={result.compareAtCents != null ? "text-[rgb(194,81,81)]" : "text-ink"}>
                            {formatPrice(result.priceCents)}
                          </span>
                          {result.compareAtCents != null && (
                            <span className="text-ink line-through">{formatPrice(result.compareAtCents)}</span>
                          )}
                        </p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
              {shown && shown.total > 0 && (
                <Link
                  href={searchHref(trimmed)}
                  onClick={() => {
                    remember(trimmed);
                    onClose();
                  }}
                  className={`nav-underline mt-6 inline-flex h-11 items-center text-xs uppercase tracking-[1px] text-ink xl:mt-8 ${FOCUS_CLASS}`}
                >
                  Tüm sonuçları gör ({shown.total}) →
                </Link>
              )}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
