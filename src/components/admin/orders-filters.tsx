"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Filter } from "lucide-react";
import { SearchInput } from "@/components/admin/search-input";
import { FilterBar } from "@/components/admin/filter-bar";
import { orderStatuses, orderStatusLabel, shipmentStatuses, shipmentStatusLabel } from "@/lib/status";
import { defaultPeriod } from "@/lib/order-period";

const selectClass =
  "w-full rounded-md border border-admin-border bg-admin-surface px-3 py-2 text-sm text-admin-text focus:border-admin-accent focus:outline-none focus:ring-1 focus:ring-admin-accent";
const dateInputClass =
  "rounded-md border border-admin-border bg-admin-surface px-3 py-2 text-sm text-admin-text focus:border-admin-accent focus:outline-none focus:ring-1 focus:ring-admin-accent";

export function OrdersFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const [panelOpen, setPanelOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const panelRef = useRef<HTMLDivElement>(null);

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    params.delete("sayfa");
    router.push(params.toString() ? `${pathname}?${params.toString()}` : pathname);
  }

  const showCustomDateRange = (searchParams.get("donem") ?? defaultPeriod) === "ozel";
  const durum = searchParams.get("durum") ?? "";
  const kargoDurum = searchParams.get("kargoDurum") ?? "";
  const baslangic = searchParams.get("baslangic") ?? "";
  const bitis = searchParams.get("bitis") ?? "";

  const activeFilterCount =
    (durum ? 1 : 0) + (kargoDurum ? 1 : 0) + (showCustomDateRange && (baslangic || bitis) ? 1 : 0);

  function clearFilters() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("durum");
    params.delete("kargoDurum");
    params.delete("baslangic");
    params.delete("bitis");
    params.delete("sayfa");
    router.push(params.toString() ? `${pathname}?${params.toString()}` : pathname);
  }

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (q !== (searchParams.get("q") ?? "")) updateParam("q", q);
    }, 300);
    return () => clearTimeout(debounceRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  useEffect(() => {
    if (!panelOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setPanelOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [panelOpen]);

  return (
    <FilterBar>
      <SearchInput
        placeholder="Sipariş no, müşteri adı veya e-postaya göre ara..."
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="w-64"
      />
      <div ref={panelRef} className="relative">
        <button
          type="button"
          onClick={() => setPanelOpen((o) => !o)}
          className="flex items-center gap-2 rounded-md border border-admin-border bg-admin-surface px-3 py-2 text-sm font-medium text-admin-text hover:bg-admin-bg"
        >
          <Filter size={16} />
          Filtrele
          {activeFilterCount > 0 && (
            <span className="rounded-full bg-admin-accent/10 px-1.5 py-0.5 text-xs font-semibold text-admin-accent">
              {activeFilterCount}
            </span>
          )}
        </button>
        {panelOpen && (
          <div className="absolute left-0 z-10 mt-1 w-72 space-y-3 rounded-md border border-admin-border bg-admin-surface p-4 shadow-lg">
            <div>
              <label className="mb-1 block text-xs font-medium text-admin-text-muted">Ödeme Durumu</label>
              <select
                value={durum}
                onChange={(e) => updateParam("durum", e.target.value)}
                className={selectClass}
              >
                <option value="">Tüm ödeme durumları</option>
                {orderStatuses.map((s) => (
                  <option key={s} value={s}>
                    {orderStatusLabel[s]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-admin-text-muted">Kargo Durumu</label>
              <select
                value={kargoDurum}
                onChange={(e) => updateParam("kargoDurum", e.target.value)}
                className={selectClass}
              >
                <option value="">Tüm kargo durumları</option>
                {shipmentStatuses.map((s) => (
                  <option key={s} value={s}>
                    {shipmentStatusLabel[s]}
                  </option>
                ))}
                <option value="YOK">Kargo Yok</option>
              </select>
            </div>
            {showCustomDateRange && (
              <div>
                <label className="mb-1 block text-xs font-medium text-admin-text-muted">Tarih Aralığı</label>
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    defaultValue={baslangic}
                    onChange={(e) => updateParam("baslangic", e.target.value)}
                    className={`${dateInputClass} w-full`}
                  />
                  <span className="text-sm text-admin-text-muted">-</span>
                  <input
                    type="date"
                    defaultValue={bitis}
                    onChange={(e) => updateParam("bitis", e.target.value)}
                    className={`${dateInputClass} w-full`}
                  />
                </div>
              </div>
            )}
            <div className="flex items-center justify-between border-t border-admin-border pt-3">
              <button
                type="button"
                onClick={clearFilters}
                disabled={activeFilterCount === 0}
                className="text-xs font-medium text-admin-accent hover:underline disabled:cursor-not-allowed disabled:text-admin-text-muted disabled:no-underline"
              >
                Filtreleri Temizle
              </button>
              <button
                type="button"
                onClick={() => setPanelOpen(false)}
                className="text-xs font-medium text-admin-text-muted hover:text-admin-text"
              >
                Kapat
              </button>
            </div>
          </div>
        )}
      </div>
    </FilterBar>
  );
}
