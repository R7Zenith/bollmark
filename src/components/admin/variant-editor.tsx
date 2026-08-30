"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { DataTable, type DataTableColumn } from "@/components/admin/data-table";
import { Button } from "@/components/admin/button";
import type { BulkAction } from "@/components/admin/bulk-action-bar";

export type AttributeOption = {
  id: string;
  name: string;
  isColor: boolean;
  values: { id: string; value: string; hexColor: string | null }[];
};

export type VariantRow = {
  clientId: string;
  id?: string;
  optionValueIds: string[];
  sku: string;
  barcode: string;
  stock: string;
  price: string;
  compareAt: string;
};

export type SerializedVariant = {
  id?: string;
  optionValueIds: string[];
  sku: string;
  barcode: string | null;
  stock: number;
  priceCents: number | null;
  compareAtCents: number | null;
};

function newClientId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `row-${Math.random().toString(36).slice(2)}`;
}

export function emptyVariantRow(): VariantRow {
  return {
    clientId: newClientId(),
    optionValueIds: [],
    sku: "",
    barcode: "",
    stock: "0",
    price: "",
    compareAt: ""
  };
}

function comboKey(optionValueIds: string[]): string {
  return [...optionValueIds].sort().join("::");
}

export function serializeVariantRows(rows: VariantRow[]): SerializedVariant[] {
  return rows
    .filter((r) => r.optionValueIds.length > 0 || r.sku.trim())
    .map((r) => ({
      id: r.id,
      optionValueIds: r.optionValueIds,
      sku: r.sku.trim(),
      barcode: r.barcode.trim() || null,
      stock: Math.max(0, Math.round(Number(r.stock) || 0)),
      priceCents: r.price.trim() ? Math.round(Number(r.price) * 100) : null,
      compareAtCents: r.compareAt.trim() ? Math.round(Number(r.compareAt) * 100) : null
    }));
}

export function applyPercentDiscount(rows: VariantRow[], selectedIds: string[], pct: number): VariantRow[] {
  return rows.map((r) => {
    if (!selectedIds.includes(r.clientId)) return r;
    const baseCents = r.price.trim() ? Math.round(Number(r.price) * 100) : null;
    if (baseCents === null) return r;
    const nextCents = Math.max(0, Math.round(baseCents * (1 - pct / 100)));
    return { ...r, price: (nextCents / 100).toFixed(2) };
  });
}

export function applyStockDelta(rows: VariantRow[], selectedIds: string[], delta: number): VariantRow[] {
  return rows.map((r) => {
    if (!selectedIds.includes(r.clientId)) return r;
    const next = Math.max(0, Math.round(Number(r.stock) || 0) + delta);
    return { ...r, stock: String(next) };
  });
}

// Secili degerlerin kartezyen kombinasyonunu uretir (2 beden x 2 renk = 4 satir).
// Zaten var olan kombinasyonlar (ayni optionValueIds seti) tekrar eklenmez.
export function generateVariantCombinations(
  rows: VariantRow[],
  selected: Record<string, Set<string>>
): VariantRow[] {
  const axes = Object.values(selected)
    .map((set) => Array.from(set))
    .filter((ids) => ids.length > 0);
  if (axes.length === 0) return rows;

  const combos = axes.reduce<string[][]>(
    (acc, ids) => acc.flatMap((combo) => ids.map((id) => [...combo, id])),
    [[]]
  );

  const existingKeys = new Set(rows.map((r) => comboKey(r.optionValueIds)));
  const newRows = combos
    .filter((combo) => !existingKeys.has(comboKey(combo)))
    .map((combo) => ({ ...emptyVariantRow(), optionValueIds: combo }));

  return [...rows, ...newRows];
}

const cellInputClass =
  "w-full min-w-[6rem] rounded border border-admin-border px-2 py-1.5 text-sm focus:border-admin-accent focus:outline-none focus:ring-1 focus:ring-admin-accent";

function ColorDot({ hexColor }: { hexColor: string }) {
  return (
    <span
      className="h-3.5 w-3.5 shrink-0 rounded-full border border-admin-border"
      style={{ backgroundColor: hexColor }}
    />
  );
}

export function VariantEditor({
  fieldName,
  initialRows,
  attributes,
  defaultPriceLabel,
  defaultCompareAtLabel
}: {
  fieldName: string;
  initialRows: VariantRow[];
  attributes: AttributeOption[];
  defaultPriceLabel: string;
  defaultCompareAtLabel: string;
}) {
  const [rows, setRows] = useState<VariantRow[]>(
    initialRows.length > 0 ? initialRows : [emptyVariantRow()]
  );
  const [selected, setSelected] = useState<Record<string, Set<string>>>({});

  function updateRow(clientId: string, patch: Partial<VariantRow>) {
    setRows((prev) => prev.map((r) => (r.clientId === clientId ? { ...r, ...patch } : r)));
  }

  function addRow() {
    setRows((prev) => [...prev, emptyVariantRow()]);
  }

  function removeRows(clientIds: string[]) {
    setRows((prev) => prev.filter((r) => !clientIds.includes(r.clientId)));
  }

  function toggleValue(attributeId: string, valueId: string) {
    setSelected((prev) => {
      const current = new Set(prev[attributeId] ?? []);
      if (current.has(valueId)) current.delete(valueId);
      else current.add(valueId);
      return { ...prev, [attributeId]: current };
    });
  }

  function createCombinations() {
    setRows((prev) => generateVariantCombinations(prev, selected));
  }

  function bulkActions(selectedIds: string[], clearSelection: () => void): BulkAction[] {
    return [
      {
        label: "% İndirim Uygula",
        variant: "secondary",
        onClick: () => {
          const input = window.prompt("Seçili varyantlara uygulanacak indirim yüzdesi (örn. 10):");
          if (!input) return;
          const pct = Number(input);
          if (Number.isNaN(pct) || pct <= 0 || pct >= 100) {
            window.alert("Geçerli bir yüzde girin (0-100 arası).");
            return;
          }
          setRows((prev) => applyPercentDiscount(prev, selectedIds, pct));
          clearSelection();
        }
      },
      {
        label: "Stok Ekle/Çıkar",
        variant: "secondary",
        onClick: () => {
          const input = window.prompt(
            "Seçili varyantların stoğuna eklenecek/çıkarılacak miktar (negatif olabilir, örn. -5):"
          );
          if (!input) return;
          const delta = Math.round(Number(input));
          if (Number.isNaN(delta)) {
            window.alert("Geçerli bir sayı girin.");
            return;
          }
          setRows((prev) => applyStockDelta(prev, selectedIds, delta));
          clearSelection();
        }
      },
      {
        label: "Seçilenleri Sil",
        variant: "danger",
        onClick: () => {
          if (!window.confirm(`${selectedIds.length} varyantı silmek istediğinize emin misiniz?`)) return;
          removeRows(selectedIds);
          clearSelection();
        }
      }
    ];
  }

  const attributeColumns: DataTableColumn<VariantRow>[] = attributes.map((attr) => ({
    key: `attr-${attr.id}`,
    header: attr.name,
    render: (row) => {
      const val = attr.values.find((v) => row.optionValueIds.includes(v.id));
      if (!val) return <span className="text-admin-text-muted">—</span>;
      return (
        <span className="inline-flex items-center gap-1.5">
          {val.hexColor && <ColorDot hexColor={val.hexColor} />}
          {val.value}
        </span>
      );
    }
  }));

  const columns: DataTableColumn<VariantRow>[] = [
    ...attributeColumns,
    {
      key: "sku",
      header: "SKU",
      render: (row) => (
        <input
          value={row.sku}
          onChange={(e) => updateRow(row.clientId, { sku: e.target.value })}
          placeholder="BLM-001-M-SYH"
          className={`${cellInputClass} font-mono`}
        />
      )
    },
    {
      key: "barcode",
      header: "Barkod",
      render: (row) => (
        <input
          value={row.barcode}
          onChange={(e) => updateRow(row.clientId, { barcode: e.target.value })}
          placeholder="opsiyonel"
          className={`${cellInputClass} font-mono`}
        />
      )
    },
    {
      key: "stock",
      header: "Stok",
      render: (row) => (
        <input
          type="number"
          min={0}
          step={1}
          value={row.stock}
          onChange={(e) => updateRow(row.clientId, { stock: e.target.value })}
          className={`${cellInputClass} w-20`}
        />
      )
    },
    {
      key: "price",
      header: "Fiyat (TL)",
      render: (row) => (
        <input
          type="number"
          min={0}
          step={0.01}
          value={row.price}
          onChange={(e) => updateRow(row.clientId, { price: e.target.value })}
          placeholder={`Varsayılan: ${defaultPriceLabel}`}
          className={`${cellInputClass} w-32`}
        />
      )
    },
    {
      key: "compareAt",
      header: "İndirim Öncesi (TL)",
      render: (row) => (
        <input
          type="number"
          min={0}
          step={0.01}
          value={row.compareAt}
          onChange={(e) => updateRow(row.clientId, { compareAt: e.target.value })}
          placeholder={defaultCompareAtLabel}
          className={`${cellInputClass} w-32`}
        />
      )
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (row) => (
        <button
          type="button"
          onClick={() => removeRows([row.clientId])}
          className="text-red-600 hover:text-red-700"
          aria-label="Varyantı sil"
        >
          <Trash2 size={16} />
        </button>
      )
    }
  ];

  return (
    <div className="space-y-4">
      <div className="space-y-4 rounded-lg border border-admin-border bg-admin-bg/40 p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-admin-text-muted">Varyant Oluştur</p>
        {attributes.length === 0 ? (
          <p className="text-sm text-admin-text-muted">
            Henüz bir varyant özelliği tanımlanmadı.{" "}
            <a href="/admin/ayarlar/varyant-ozellikleri" target="_blank" className="text-admin-accent underline">
              Varyant Özellikleri
            </a>{" "}
            sayfasından Beden, Renk gibi özellikler ekleyin.
          </p>
        ) : (
          <>
            {attributes.map((attr) => (
              <div key={attr.id}>
                <p className="mb-1.5 text-xs font-medium text-admin-text-muted">{attr.name}</p>
                {attr.values.length === 0 ? (
                  <p className="text-sm text-admin-text-muted">Bu özellik için henüz değer eklenmedi.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {attr.values.map((val) => {
                      const isSelected = selected[attr.id]?.has(val.id) ?? false;
                      return (
                        <button
                          key={val.id}
                          type="button"
                          onClick={() => toggleValue(attr.id, val.id)}
                          className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors ${
                            isSelected
                              ? "border-admin-accent bg-indigo-50 text-admin-accent"
                              : "border-admin-border text-admin-text hover:bg-admin-bg"
                          }`}
                        >
                          {val.hexColor && <ColorDot hexColor={val.hexColor} />}
                          {val.value}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
            <Button type="button" variant="secondary" size="sm" onClick={createCombinations}>
              Varyantları Oluştur
            </Button>
          </>
        )}
      </div>

      <DataTable
        columns={columns}
        data={rows}
        getRowId={(r) => r.clientId}
        selectable
        bulkActions={bulkActions}
        emptyTitle="Henüz varyant yok"
      />
      <Button type="button" variant="secondary" size="sm" onClick={addRow}>
        <Plus size={14} /> Varyant Ekle
      </Button>
      <input type="hidden" name={fieldName} value={JSON.stringify(serializeVariantRows(rows))} />
    </div>
  );
}
