"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, ImageOff, Plus, Search, X } from "lucide-react";

export type BundleProductOption = {
  id: string;
  name: string;
  code: string | null;
  image: string | null;
  published: boolean;
  skus: string[];
  outOfStock: boolean;
};

const RESULT_LIMIT = 120;

const normalize = (s: string) => s.toLocaleLowerCase("tr").replace(/\s+/g, " ").trim();

// Bundle formlarinda urun secimi: secilenler kucuk resimli etiketler olarak
// gorunur, "Ürün seç" kucuk resimli bir pencere acar. Arama ad, urun kodu ve
// varyant SKU'larinda; her kelime ayri aranir ("kazak 6SAM" gibi).
export function BundleProductPicker({
  allProducts,
  selectedIds,
  onToggle
}: {
  allProducts: BundleProductOption[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [onlyPublished, setOnlyPublished] = useState(true);

  const haystacks = useMemo(
    () => new Map(allProducts.map((p) => [p.id, normalize([p.name, p.code ?? "", ...p.skus].join(" "))])),
    [allProducts]
  );
  const results = useMemo(() => {
    const words = normalize(query).split(" ").filter(Boolean);
    return allProducts.filter(
      (p) =>
        (!onlyPublished || p.published || selectedIds.has(p.id)) &&
        words.every((w) => haystacks.get(p.id)!.includes(w))
    );
  }, [allProducts, haystacks, query, onlyPublished, selectedIds]);
  const selected = allProducts.filter((p) => selectedIds.has(p.id));

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        {selected.map((p) => (
          <span
            key={p.id}
            className="flex items-center gap-2 rounded-md border border-admin-border bg-admin-bg py-1 pl-1 pr-2 text-xs text-admin-text"
          >
            <Thumb image={p.image} className="h-8 w-6" />
            <span className="max-w-[220px] truncate">{p.name}</span>
            <button
              type="button"
              onClick={() => onToggle(p.id)}
              className="text-admin-text-muted hover:text-red-600"
              aria-label={`${p.name} kaldır`}
            >
              <X size={12} />
            </button>
          </span>
        ))}
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex items-center gap-1.5 rounded-md border border-dashed border-admin-border px-3 py-2 text-xs text-admin-accent hover:border-admin-accent"
        >
          <Plus size={14} />
          {selected.length === 0 ? "Ürün seç (en az 2)" : "Ürün ekle / çıkar"}
        </button>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="flex h-[85vh] w-full max-w-4xl flex-col rounded-lg bg-admin-surface shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 border-b border-admin-border p-4">
              <div className="relative flex-1">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-admin-text-muted" />
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  // Pencere bundle formunun icinde - Enter formu gondermesin.
                  onKeyDown={(e) => {
                    if (e.key === "Enter") e.preventDefault();
                  }}
                  placeholder="Ürün adı, ürün kodu veya SKU ile ara..."
                  className="w-full rounded-md border border-admin-border py-2 pl-9 pr-3 text-sm focus:border-admin-accent focus:outline-none focus:ring-1 focus:ring-admin-accent"
                />
              </div>
              <label className="flex shrink-0 items-center gap-2 text-xs text-admin-text-muted">
                <input
                  type="checkbox"
                  checked={onlyPublished}
                  onChange={(e) => setOnlyPublished(e.target.checked)}
                  className="h-4 w-4 rounded border-admin-border text-admin-accent focus:ring-admin-accent"
                />
                Yalnız yayındakiler
              </label>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md p-1.5 text-admin-text-muted hover:bg-admin-bg"
                aria-label="Kapat"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {results.length === 0 ? (
                <p className="py-10 text-center text-sm text-admin-text-muted">Sonuç yok.</p>
              ) : (
                <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
                  {results.slice(0, RESULT_LIMIT).map((p) => {
                    const isSelected = selectedIds.has(p.id);
                    return (
                      <li key={p.id}>
                        <button
                          type="button"
                          onClick={() => onToggle(p.id)}
                          aria-pressed={isSelected}
                          className={`group block w-full rounded-md p-1 text-left ${
                            isSelected ? "bg-indigo-50 ring-2 ring-admin-accent" : "hover:bg-admin-bg"
                          }`}
                        >
                          <span className="relative block">
                            <Thumb image={p.image} className="aspect-[3/4] w-full" />
                            {isSelected && (
                              <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-admin-accent text-white">
                                <Check size={12} />
                              </span>
                            )}
                            <ProductFlags product={p} />
                          </span>
                          <span className="mt-1 line-clamp-2 block text-[11px] leading-tight text-admin-text">{p.name}</span>
                          {p.code && <span className="block truncate text-[10px] text-admin-text-muted">{p.code}</span>}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
              {results.length > RESULT_LIMIT && (
                <p className="mt-4 text-center text-xs text-admin-text-muted">
                  İlk {RESULT_LIMIT} sonuç gösteriliyor ({results.length}). Aramayı daraltın.
                </p>
              )}
            </div>

            <div className="flex items-center justify-between border-t border-admin-border p-4">
              <span className="text-sm text-admin-text-muted">{selected.length} ürün seçildi</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md bg-admin-accent px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700"
              >
                Tamam
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function Thumb({ image, className }: { image: string | null; className: string }) {
  return image ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={image} alt="" loading="lazy" className={`${className} shrink-0 rounded bg-admin-bg object-cover`} />
  ) : (
    <span className={`${className} flex shrink-0 items-center justify-center rounded bg-admin-bg text-admin-text-muted`}>
      <ImageOff size={14} />
    </span>
  );
}

// Kombini anasayfada/kombin sayfasinda gizleyen durumlar (bkz.
// home-products.ts pickHomeBundles): yayinda olmayan ya da stogu biten urun.
export function ProductFlags({ product }: { product: Pick<BundleProductOption, "published" | "outOfStock"> }) {
  if (product.published && !product.outOfStock) return null;
  return (
    <span className="absolute inset-x-0 bottom-0 flex flex-col items-start gap-0.5 p-1">
      {!product.published && (
        <span className="rounded bg-yellow-100 px-1 text-[10px] leading-4 text-yellow-800">Taslak</span>
      )}
      {product.outOfStock && <span className="rounded bg-red-100 px-1 text-[10px] leading-4 text-red-700">Stok yok</span>}
    </span>
  );
}
