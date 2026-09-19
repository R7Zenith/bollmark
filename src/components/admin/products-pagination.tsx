"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

// ‹ 1 … 4 5 [6] 7 8 … 13 › için gösterilecek sayfalar; null = ellipsis
function pageItems(page: number, totalPages: number): (number | null)[] {
  const wanted = new Set([1, totalPages, page - 1, page, page + 1]);
  const pages = Array.from(wanted)
    .filter((p) => p >= 1 && p <= totalPages)
    .sort((a, b) => a - b);
  const items: (number | null)[] = [];
  pages.forEach((p, i) => {
    if (i > 0 && p - pages[i - 1] > 1) items.push(null);
    items.push(p);
  });
  return items;
}

const navButtonClass =
  "flex h-8 w-8 items-center justify-center rounded-md border border-admin-border text-admin-text-muted hover:bg-admin-bg disabled:pointer-events-none disabled:opacity-40";

export function ProductsPagination({
  page,
  pageSize,
  pageSizes,
  total
}: {
  page: number;
  pageSize: number;
  pageSizes: readonly number[];
  total: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  function go(next: { sayfa?: number; adet?: number }) {
    const params = new URLSearchParams(searchParams.toString());
    if (next.adet !== undefined) {
      params.set("adet", String(next.adet));
      params.delete("sayfa");
    } else if (next.sayfa !== undefined) {
      if (next.sayfa > 1) params.set("sayfa", String(next.sayfa));
      else params.delete("sayfa");
    }
    router.push(params.toString() ? `${pathname}?${params.toString()}` : pathname);
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-xs text-admin-text-muted">
        {from}–{to} / {total} ürün
      </p>

      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-label="Önceki sayfa"
          disabled={page <= 1}
          onClick={() => go({ sayfa: page - 1 })}
          className={navButtonClass}
        >
          <ChevronLeft size={16} />
        </button>
        <span className="px-2 text-xs text-admin-text-muted md:hidden">
          Sayfa {page} / {totalPages}
        </span>
        <div className="hidden items-center gap-1 md:flex">
          {pageItems(page, totalPages).map((item, i) =>
            item === null ? (
              <span key={`gap-${i}`} className="px-1 text-xs text-admin-text-muted">
                …
              </span>
            ) : (
              <button
                key={item}
                type="button"
                aria-current={item === page ? "page" : undefined}
                onClick={() => go({ sayfa: item })}
                className={`h-8 min-w-8 rounded-md border px-2 text-xs ${
                  item === page
                    ? "border-admin-accent bg-admin-accent text-white"
                    : "border-admin-border text-admin-text hover:bg-admin-bg"
                }`}
              >
                {item}
              </button>
            )
          )}
        </div>
        <button
          type="button"
          aria-label="Sonraki sayfa"
          disabled={page >= totalPages}
          onClick={() => go({ sayfa: page + 1 })}
          className={navButtonClass}
        >
          <ChevronRight size={16} />
        </button>
      </div>

      <label className="flex items-center gap-2 text-xs text-admin-text-muted">
        Sayfada göster
        <select
          value={pageSize}
          onChange={(e) => go({ adet: Number(e.target.value) })}
          className="rounded-md border border-admin-border bg-admin-surface px-2 py-1 text-xs text-admin-text focus:border-admin-accent focus:outline-none focus:ring-1 focus:ring-admin-accent"
        >
          {pageSizes.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
