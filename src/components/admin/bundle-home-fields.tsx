"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { ImageField } from "@/components/admin/image-field";
import { Thumb, type BundleProductOption } from "@/components/admin/bundle-product-picker";
import type { BundleHotspot } from "@/lib/bundles";

// Bundle formlarinin (yeni + duzenle) anasayfa "Kombini Tamamla" alanlari:
// kombin fotografi, "Anasayfada göster", sira ve fotograf uzerindeki "+"
// noktalari. Nokta yerlestirme: listeden urun secilir (ya da fotograftaki
// noktasina tiklanir), fotografa tiklanir; x/y fotografin yuzdesi olarak
// saklanir (bkz. lib/bundles.ts parseHotspots). Satirin ustune gelince
// noktasi vurgulanir. Oklarla urun sirasi degisir (anasayfadaki liste sirasi,
// productOrderJson). Secimden cikarilan urunun noktasi/sirasi gonderilmez,
// sunucu da ayrica eler (bkz. lib/bundles.ts).
export function BundleHomeFields({
  products,
  defaultImageUrl = "",
  defaultShowOnHome = false,
  defaultHomeSortOrder = 0,
  defaultHotspots = [],
  defaultProductOrder = []
}: {
  products: BundleProductOption[];
  defaultImageUrl?: string;
  defaultShowOnHome?: boolean;
  defaultHomeSortOrder?: number;
  defaultHotspots?: BundleHotspot[];
  defaultProductOrder?: string[];
}) {
  const [imageUrl, setImageUrl] = useState(defaultImageUrl);
  const [hotspots, setHotspots] = useState<BundleHotspot[]>(defaultHotspots);
  const [placingId, setPlacingId] = useState<string | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [order, setOrder] = useState<string[]>(defaultProductOrder);

  const productIds = new Set(products.map((p) => p.id));
  // Kayitli sira once, sonradan secilen urunler sona (parseProductOrder ile ayni kural).
  const ordered = [
    ...order.flatMap((id) => products.filter((p) => p.id === id)),
    ...products.filter((p) => !order.includes(p.id))
  ];
  const visibleHotspots = hotspots.filter((h) => productIds.has(h.productId));
  const numberOf = (productId: string) => ordered.findIndex((p) => p.id === productId) + 1;

  function move(index: number, step: -1 | 1) {
    const ids = ordered.map((p) => p.id);
    [ids[index], ids[index + step]] = [ids[index + step], ids[index]];
    setOrder(ids);
  }

  function place(e: React.MouseEvent<HTMLDivElement>) {
    if (!placingId) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.round(((e.clientX - rect.left) / rect.width) * 1000) / 10;
    const y = Math.round(((e.clientY - rect.top) / rect.height) * 1000) / 10;
    setHotspots((prev) => [...prev.filter((h) => h.productId !== placingId), { productId: placingId, x, y }]);
    // Siradaki noktasiz urune gec - tek tek secmeden hepsi yerlestirilebilsin.
    const next = ordered.find((p) => p.id !== placingId && !hotspots.some((h) => h.productId === p.id));
    setPlacingId(next?.id ?? null);
  }

  return (
    <div className="space-y-4 rounded-md border border-admin-border p-4">
      <p className="text-xs font-medium text-admin-text">Anasayfa: Kombini Tamamla</p>
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
        <div className="min-w-0">
          <label className="text-xs text-admin-text-muted">Kombin fotoğrafı (dikey, 4:5 önerilir)</label>
          <ImageField value={imageUrl} onChange={setImageUrl} />
          <input type="hidden" name="imageUrl" value={imageUrl} />
        </div>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-admin-text">
            <input
              type="checkbox"
              name="showOnHome"
              defaultChecked={defaultShowOnHome}
              className="h-4 w-4 rounded border-admin-border text-admin-accent focus:ring-admin-accent"
            />
            Anasayfada göster
          </label>
          <label className="flex items-center gap-2 text-xs text-admin-text-muted">
            Sıra
            <input
              name="homeSortOrder"
              type="number"
              min={0}
              defaultValue={defaultHomeSortOrder}
              className="w-16 rounded-md border border-admin-border px-2 py-1 text-sm focus:border-admin-accent focus:outline-none focus:ring-1 focus:ring-admin-accent"
            />
          </label>
        </div>
      </div>

      {imageUrl && products.length > 0 && (
        <div className="grid gap-5 md:grid-cols-[minmax(0,360px)_minmax(0,1fr)] lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
          <div
            onClick={place}
            className={`relative aspect-[4/5] select-none overflow-hidden rounded border border-admin-border bg-admin-bg ${
              placingId ? "cursor-crosshair" : ""
            }`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageUrl} alt="" className="h-full w-full object-cover" draggable={false} />
            {visibleHotspots.map((h) => {
              const active = h.productId === placingId || h.productId === hoverId;
              return (
                <button
                  key={h.productId}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setPlacingId(h.productId);
                  }}
                  onMouseEnter={() => setHoverId(h.productId)}
                  onMouseLeave={() => setHoverId(null)}
                  title="Yeniden yerleştirmek için seç"
                  style={{ left: `${h.x}%`, top: `${h.y}%` }}
                  className={`absolute flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-xs font-semibold shadow-md transition-transform ${
                    active ? "scale-125 bg-admin-accent text-white" : "bg-white text-admin-text"
                  }`}
                >
                  {numberOf(h.productId)}
                </button>
              );
            })}
            {placingId && (
              <span className="pointer-events-none absolute inset-x-2 bottom-2 rounded bg-black/70 px-2 py-1 text-center text-[11px] text-white">
                {numberOf(placingId)} numaralı ürünün yerine tıklayın
              </span>
            )}
          </div>
          <div className="min-w-0 space-y-2">
            <p className="text-xs text-admin-text-muted">
              Ürünü seçip fotoğrafta o ürünün üstüne tıklayın. Noktaya tıklayarak yerini değiştirebilirsiniz. Oklarla
              anasayfadaki liste sırasını değiştirin. Noktasız ürün anasayfada yalnız listede görünür.
            </p>
            <ul className="space-y-1.5">
              {ordered.map((p, i) => {
                const hasSpot = visibleHotspots.some((h) => h.productId === p.id);
                const placing = placingId === p.id;
                return (
                  <li
                    key={p.id}
                    onMouseEnter={() => setHoverId(p.id)}
                    onMouseLeave={() => setHoverId(null)}
                    className={`flex items-center gap-3 rounded-md border px-2 py-1.5 text-xs ${
                      placing
                        ? "border-admin-accent bg-indigo-50"
                        : hoverId === p.id
                          ? "border-admin-accent/50"
                          : "border-admin-border"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setPlacingId(placing ? null : p.id)}
                      className="flex min-w-0 flex-1 items-center gap-3 text-left text-admin-text"
                    >
                      <span
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
                          hasSpot ? "bg-admin-accent text-white" : "border border-admin-border text-admin-text-muted"
                        }`}
                      >
                        {i + 1}
                      </span>
                      <Thumb image={p.image} className="h-12 w-9" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{p.name}</span>
                        <span className="block text-[11px] text-admin-text-muted">
                          {placing ? "Fotoğrafa tıklayın" : hasSpot ? "Yerleşti" : "Nokta yok, seçmek için tıklayın"}
                        </span>
                      </span>
                    </button>
                    {hasSpot && (
                      <button
                        type="button"
                        onClick={() => setHotspots((prev) => prev.filter((h) => h.productId !== p.id))}
                        className="shrink-0 px-1 text-admin-text-muted hover:text-red-600"
                      >
                        Kaldır
                      </button>
                    )}
                    <span className="flex shrink-0 flex-col">
                      <button
                        type="button"
                        onClick={() => move(i, -1)}
                        disabled={i === 0}
                        aria-label={`${p.name} yukarı taşı`}
                        className="rounded p-0.5 text-admin-text-muted hover:bg-admin-bg hover:text-admin-text disabled:opacity-30 disabled:hover:bg-transparent"
                      >
                        <ChevronUp size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => move(i, 1)}
                        disabled={i === ordered.length - 1}
                        aria-label={`${p.name} aşağı taşı`}
                        className="rounded p-0.5 text-admin-text-muted hover:bg-admin-bg hover:text-admin-text disabled:opacity-30 disabled:hover:bg-transparent"
                      >
                        <ChevronDown size={14} />
                      </button>
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
      <input type="hidden" name="hotspotsJson" value={JSON.stringify(visibleHotspots)} />
      <input type="hidden" name="productOrderJson" value={JSON.stringify(ordered.map((p) => p.id))} />
    </div>
  );
}
