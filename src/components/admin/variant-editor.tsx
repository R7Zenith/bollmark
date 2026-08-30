"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { DataTable, type DataTableColumn } from "@/components/admin/data-table";
import { Button } from "@/components/admin/button";
import type { BulkAction } from "@/components/admin/bulk-action-bar";
import { VariantImageCell } from "@/components/admin/variant-image-cell";

export type VariantRow = {
  clientId: string;
  id?: string;
  size: string;
  color: string;
  sku: string;
  stock: string;
  price: string;
  compareAt: string;
  imageUrl: string;
};

export type SerializedVariant = {
  id?: string;
  size: string;
  color: string;
  sku: string;
  stock: number;
  priceCents: number | null;
  compareAtCents: number | null;
  imageUrl: string | null;
};

function newClientId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `row-${Math.random().toString(36).slice(2)}`;
}

export function emptyVariantRow(): VariantRow {
  return {
    clientId: newClientId(),
    size: "",
    color: "",
    sku: "",
    stock: "0",
    price: "",
    compareAt: "",
    imageUrl: ""
  };
}

export function serializeVariantRows(rows: VariantRow[]): SerializedVariant[] {
  return rows
    .filter((r) => r.size.trim() || r.color.trim() || r.sku.trim())
    .map((r) => ({
      id: r.id,
      size: r.size.trim(),
      color: r.color.trim(),
      sku: r.sku.trim(),
      stock: Math.max(0, Math.round(Number(r.stock) || 0)),
      priceCents: r.price.trim() ? Math.round(Number(r.price) * 100) : null,
      compareAtCents: r.compareAt.trim() ? Math.round(Number(r.compareAt) * 100) : null,
      imageUrl: r.imageUrl.trim() || null
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

const cellInputClass =
  "w-full min-w-[6rem] rounded border border-admin-border px-2 py-1.5 text-sm focus:border-admin-accent focus:outline-none focus:ring-1 focus:ring-admin-accent";

export function VariantEditor({
  fieldName,
  initialRows,
  defaultPriceLabel,
  defaultCompareAtLabel
}: {
  fieldName: string;
  initialRows: VariantRow[];
  defaultPriceLabel: string;
  defaultCompareAtLabel: string;
}) {
  const [rows, setRows] = useState<VariantRow[]>(
    initialRows.length > 0 ? initialRows : [emptyVariantRow()]
  );

  function updateRow(clientId: string, patch: Partial<VariantRow>) {
    setRows((prev) => prev.map((r) => (r.clientId === clientId ? { ...r, ...patch } : r)));
  }

  function addRow() {
    setRows((prev) => [...prev, emptyVariantRow()]);
  }

  function removeRows(clientIds: string[]) {
    setRows((prev) => prev.filter((r) => !clientIds.includes(r.clientId)));
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

  const columns: DataTableColumn<VariantRow>[] = [
    {
      key: "size",
      header: "Beden",
      render: (row) => (
        <input
          value={row.size}
          onChange={(e) => updateRow(row.clientId, { size: e.target.value })}
          placeholder="M"
          className={cellInputClass}
        />
      )
    },
    {
      key: "color",
      header: "Renk",
      render: (row) => (
        <input
          value={row.color}
          onChange={(e) => updateRow(row.clientId, { color: e.target.value })}
          placeholder="Siyah"
          className={cellInputClass}
        />
      )
    },
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
      key: "imageUrl",
      header: "Görsel",
      render: (row) => (
        <VariantImageCell
          value={row.imageUrl}
          onChange={(url) => updateRow(row.clientId, { imageUrl: url })}
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
    <div className="space-y-3">
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
