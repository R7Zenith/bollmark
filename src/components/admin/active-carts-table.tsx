"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { CartLineList } from "@/components/admin/cart-line-list";
import { formatExactPrice } from "@/lib/format";
import type { ResolvedCartLine } from "@/lib/cart-shared";

export interface ActiveCartRow {
  id: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string | null;
  lines: ResolvedCartLine[];
  itemsSummary: string;
  itemCount: number;
  totalCents: number;
  couponCode: string | null;
  updatedAtRelative: string;
  updatedAtFull: string;
}

const thClass = "px-4 py-3";
const tdClass = "px-4 py-3 text-admin-text";

// DataTable satir genisletmeyi desteklemedigi icin ayni gorunumde sade tablo.
export function ActiveCartsTable({ carts }: { carts: ActiveCartRow[] }) {
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="rounded-lg border border-admin-border bg-admin-surface">
      <div className="overflow-x-auto">
        <table className="w-full min-w-max border-collapse text-sm">
          <thead>
            <tr className="border-b border-admin-border text-left text-xs uppercase tracking-wide text-admin-text-muted">
              <th className="w-10 px-4 py-3" />
              <th className={thClass}>Müşteri</th>
              <th className={thClass}>Ürünler</th>
              <th className={`${thClass} text-right`}>Adet</th>
              <th className={`${thClass} text-right`}>Tutar</th>
              <th className={thClass}>Kupon</th>
              <th className={thClass}>Son Güncelleme</th>
            </tr>
          </thead>
          <tbody>
            {carts.map((cart) => {
              const isOpen = openIds.has(cart.id);
              return (
                <Fragment key={cart.id}>
                  <tr
                    onClick={() => toggle(cart.id)}
                    className="cursor-pointer border-b border-admin-border hover:bg-admin-bg/50"
                  >
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        aria-expanded={isOpen}
                        aria-label={isOpen ? "Sepet detayını kapat" : "Sepet detayını aç"}
                        className="flex h-6 w-6 items-center justify-center rounded text-admin-text-muted hover:bg-admin-bg"
                      >
                        <ChevronRight size={16} className={`transition-transform ${isOpen ? "rotate-90" : ""}`} />
                      </button>
                    </td>
                    <td className={tdClass}>
                      <Link
                        href={`/admin/musteriler/${cart.customerId}`}
                        onClick={(e) => e.stopPropagation()}
                        className="font-medium text-admin-text hover:text-admin-accent hover:underline"
                      >
                        {cart.customerName}
                      </Link>
                      <p className="text-xs text-admin-text-muted">{cart.customerEmail}</p>
                      {cart.customerPhone && <p className="text-xs text-admin-text-muted">{cart.customerPhone}</p>}
                    </td>
                    <td className={tdClass}>
                      <p className="max-w-xs truncate text-admin-text-muted" title={cart.itemsSummary}>
                        {cart.itemsSummary}
                      </p>
                    </td>
                    <td className={`${tdClass} text-right`}>{cart.itemCount}</td>
                    <td className={`${tdClass} text-right font-medium`}>{formatExactPrice(cart.totalCents)}</td>
                    <td className={tdClass}>
                      {cart.couponCode ? (
                        <span className="font-mono text-xs">{cart.couponCode}</span>
                      ) : (
                        <span className="text-admin-text-muted">-</span>
                      )}
                    </td>
                    <td className={tdClass}>
                      <span className="text-admin-text-muted" title={cart.updatedAtFull}>
                        {cart.updatedAtRelative}
                      </span>
                    </td>
                  </tr>
                  {isOpen && (
                    <tr className="border-b border-admin-border bg-admin-bg/40">
                      <td />
                      <td colSpan={6} className="px-4 pb-2">
                        <CartLineList lines={cart.lines} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
