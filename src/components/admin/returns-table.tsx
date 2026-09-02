"use client";

import { useState } from "react";
import Link from "next/link";
import { Pencil } from "lucide-react";
import { DataTable, type DataTableColumn } from "@/components/admin/data-table";
import { Badge } from "@/components/admin/badge";
import { returnStatuses, returnStatusLabel, returnStatusTone, returnTypeLabel } from "@/lib/status";

export interface ReturnRow {
  id: string;
  orderId: string;
  orderNumber: string;
  customerName: string;
  type: string;
  reason: string;
  itemsSummary: string;
  status: string;
  adminNote: string | null;
  createdAtLabel: string;
}

const inputClass =
  "w-full rounded-md border border-admin-border px-2 py-1.5 text-sm focus:border-admin-accent focus:outline-none focus:ring-1 focus:ring-admin-accent";

export function ReturnsTable({
  returns,
  updateAction
}: {
  returns: ReturnRow[];
  updateAction: (formData: FormData) => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);

  const columns: DataTableColumn<ReturnRow>[] = [
    {
      key: "orderNumber",
      header: "Sipariş",
      render: (row) => (
        <div>
          <Link href={`/admin/siparisler/${row.orderId}`} className="font-mono font-medium text-admin-text hover:underline">
            {row.orderNumber}
          </Link>
          <p className="text-xs text-admin-text-muted">{row.customerName}</p>
        </div>
      )
    },
    {
      key: "type",
      header: "Tip / Sebep",
      render: (row) => (
        <div>
          <p className="text-admin-text">{returnTypeLabel[row.type as keyof typeof returnTypeLabel] ?? row.type}</p>
          <p className="text-xs text-admin-text-muted">{row.reason}</p>
        </div>
      )
    },
    {
      key: "items",
      header: "Ürünler",
      render: (row) => <span className="text-admin-text-muted">{row.itemsSummary}</span>
    },
    {
      key: "status",
      header: "Durum",
      render: (row) =>
        row.id === editingId ? (
          <form id={`return-form-${row.id}`} action={updateAction}>
            <input type="hidden" name="returnId" value={row.id} />
            <select name="status" defaultValue={row.status} className={inputClass}>
              {returnStatuses.map((s) => (
                <option key={s} value={s}>
                  {returnStatusLabel[s]}
                </option>
              ))}
            </select>
          </form>
        ) : (
          <Badge tone={returnStatusTone[row.status as keyof typeof returnStatusTone]}>
            {returnStatusLabel[row.status as keyof typeof returnStatusLabel] ?? row.status}
          </Badge>
        )
    },
    {
      key: "adminNote",
      header: "Admin Notu",
      render: (row) =>
        row.id === editingId ? (
          <input
            form={`return-form-${row.id}`}
            name="adminNote"
            defaultValue={row.adminNote ?? ""}
            placeholder="Not ekle"
            className={inputClass}
          />
        ) : (
          row.adminNote || <span className="text-admin-text-muted">-</span>
        )
    },
    {
      key: "createdAt",
      header: "Tarih",
      render: (row) => <span className="text-admin-text-muted">{row.createdAtLabel}</span>
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (row) =>
        row.id === editingId ? (
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setEditingId(null)}
              className="rounded-md border border-admin-border px-3 py-1.5 text-xs font-medium text-admin-text hover:bg-admin-bg"
            >
              Vazgeç
            </button>
            <button
              type="submit"
              form={`return-form-${row.id}`}
              className="rounded-md bg-admin-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
            >
              Kaydet
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setEditingId(row.id)}
            className="rounded-md p-1.5 text-admin-text-muted hover:bg-admin-bg"
            title="Düzenle"
          >
            <Pencil size={15} />
          </button>
        )
    }
  ];

  return (
    <DataTable
      columns={columns}
      data={returns}
      getRowId={(row) => row.id}
      emptyTitle="Sonuç bulunamadı"
      emptyDescription="Arama veya filtre kriterlerine uygun iade talebi yok."
    />
  );
}
