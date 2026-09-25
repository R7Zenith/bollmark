"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { ProductCard, type ProductCardData } from "@/components/product-card";
import { CATALOG_PAGE_SIZE, CATALOG_SHOW_PARAM } from "@/lib/catalog-filters";
import { loadMoreCatalog } from "@/app/(site)/urunler/actions";

// Katalog grid'i + "Daha Fazla Goster" blogu (bkz. KATALOG_DAHA_FAZLA_YUKLE_PLANI.md).
// Bilincli olarak sonsuz kaydirma YOK: yeni parti yalnizca butona basinca
// gelir, footer her zaman erisilebilir kalir. Buton aslinda ?goster=N
// baglantisi - JS kapaliyken ve arama motorlari icin sunucu o kadar karti
// render eder; JS varken sayfa yeniden render edilmeden sunucu aksiyonuyla
// eklenir ve URL replaceState ile guncellenir (router.push kaydirmayi bozardi).

function cardKey(item: ProductCardData) {
  return `${item.productId}-${item.colorLabel ?? "tek"}`;
}

// Geri tusu icin: Next geri donuste sayfanin ilk render'ini (ilk parti)
// onbellekten geri yukler, replaceState bunu guncellemez. Butonla yuklenen
// liste burada sorguya gore tutulur; URL'deki ?goster ayni sayiyi gosteriyorsa
// grid dogrudan bu listeyle acilir ve tarayici kaydirma konumunu geri yukler.
// Modul seviyesinde oldugu icin tam sayfa yenilemede bosalir (sunucu zaten
// ?goster kadar karti render eder).
const loadedByQuery = new Map<string, ProductCardData[]>();

export function CatalogGrid({
  initialItems,
  total,
  query
}: {
  initialItems: ProductCardData[];
  total: number;
  // Mevcut arama parametreleri (goster haric).
  query: string;
}) {
  const searchParams = useSearchParams();
  const urlShow = searchParams.get(CATALOG_SHOW_PARAM);
  // URL'deki ?goster ile daha once butonla yuklenmis liste uyusuyorsa o,
  // yoksa sunucunun gonderdigi ilk liste.
  const pickItems = () => {
    const loaded = loadedByQuery.get(query);
    return loaded && loaded.length > initialItems.length && Number(urlShow) === loaded.length
      ? loaded
      : initialItems;
  };
  const [initial, setInitial] = useState(pickItems);
  const [items, setItems] = useState(initial);
  // Ilk render'daki kartlar animasyonsuz gelir; bu indeksten sonrakiler yeni.
  const [animateFrom, setAnimateFrom] = useState(initial.length);
  const [isPending, startTransition] = useTransition();
  // Ayni rota icinde gezinmede grid yeniden mount olmaz (ör. ?goster=72'den
  // ?goster'siz linke tiklayip geri donmek). URL'deki ?goster gosterilen kart
  // sayisiyla uyusmuyorsa liste yeniden secilir. Yukleme surerken bakilmaz:
  // replaceState ile yeni liste ayni anda islenmeyebilir.
  if (!isPending && Number(urlShow ?? initialItems.length) !== items.length) {
    const next = pickItems();
    if (next !== items) {
      setInitial(next);
      setItems(next);
      setAnimateFrom(next.length);
    }
  }
  const [announcement, setAnnouncement] = useState("");
  const [failed, setFailed] = useState(false);
  const firstNewRef = useRef<HTMLDivElement>(null);

  const shown = items.length;
  const hrefFor = (count: number) =>
    `/urunler?${query ? `${query}&` : ""}${CATALOG_SHOW_PARAM}=${count}`;

  // Yeni parti eklenince klavye odagi ilk yeni karta gecer (ekran kaymadan).
  useEffect(() => {
    if (items.length === initial.length) return;
    firstNewRef.current?.querySelector("a")?.focus({ preventScroll: true });
  }, [items.length, initial.length]);

  const loadMore = () => {
    if (isPending) return;
    setFailed(false);
    startTransition(async () => {
      try {
        const { items: next } = await loadMoreCatalog(query, shown);
        const count = shown + next.length;
        const merged = [...items, ...next];
        loadedByQuery.set(query, merged);
        window.history.replaceState(null, "", hrefFor(count));
        setAnimateFrom(shown);
        setItems(merged);
        setAnnouncement(`${next.length} ürün daha yüklendi`);
      } catch {
        setFailed(true);
      }
    });
  };

  return (
    <>
      {/* Mobilde gorseller ekran kenarina yapisik olsun diye grid ust
          konteynerin px-4'unu -mx-4 ile iptal ediyor (bkz.
          MOBIL_KATALOG_GORSEL_BOSLUK_PLANI.md); masaustunde mx-0 ile eski
          hale donuyor. Sutunlar arasi bosluk mobilde ince (gap-x-0.5),
          satirlar arasi kart metni icin daha genis (gap-y-3); masaustunde
          Release'de olculmus gercek deger olan gap-6 korunuyor. */}
      <div className="mt-8 -mx-4 grid grid-cols-2 gap-x-0.5 gap-y-3 md:mx-0 md:grid-cols-4 md:gap-6">
        {/* Her kart ayni sarmalayicida - partiler eklendikce eski kartlar
            yeniden mount olmasin. Animasyon sinifi yalnizca sonradan gelen
            kartlarda; eleman kalici oldugu icin bir kez oynar. */}
        {items.map((item, i) => (
          <div
            key={cardKey(item)}
            ref={i === animateFrom ? firstNewRef : undefined}
            className={i >= initial.length ? "animate-catalog-in motion-reduce:animate-none" : undefined}
            style={
              i >= animateFrom ? { animationDelay: `${Math.min((i - animateFrom) * 30, 300)}ms` } : undefined
            }
          >
            <ProductCard product={item} />
          </div>
        ))}
      </div>

      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

      {total > CATALOG_PAGE_SIZE && (
        <div className="mt-16 flex flex-col items-center gap-5">
          {shown < total ? (
            <>
              <p className="text-xs tracking-[0.48px] text-ink/60">
                {shown} / {total} ürün gösteriliyor
              </p>
              <div className="h-[2px] w-40 bg-ink/10">
                <div
                  className="h-full bg-ink transition-[width] duration-500"
                  style={{ width: `${(shown / total) * 100}%` }}
                />
              </div>
              <a
                href={hrefFor(shown + CATALOG_PAGE_SIZE)}
                onClick={(e) => {
                  e.preventDefault();
                  loadMore();
                }}
                aria-busy={isPending}
                aria-disabled={isPending}
                className={`flex h-[44px] items-center justify-center rounded-[50px] border border-ink px-8 text-[10px] uppercase tracking-[1px] text-ink transition duration-300 hover:bg-ink hover:text-cream ${
                  isPending ? "pointer-events-none opacity-60" : ""
                }`}
              >
                {isPending ? "Yükleniyor" : "Daha Fazla Göster"}
              </a>
              {failed && <p className="text-xs tracking-[0.48px] text-ink/60">Yüklenemedi, tekrar deneyin</p>}
            </>
          ) : (
            <>
              <p className="text-xs tracking-[0.48px] text-ink/60">Tüm ürünleri gördünüz · {total} ürün</p>
              <button
                type="button"
                onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                className="text-[10px] uppercase tracking-[1px] text-ink underline underline-offset-2"
              >
                Başa dön ↑
              </button>
            </>
          )}
        </div>
      )}
    </>
  );
}
