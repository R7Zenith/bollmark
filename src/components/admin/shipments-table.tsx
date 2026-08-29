"use client";

import { useState } from "react";
import Link from "next/link";
import { Pencil } from "lucide-react";
import { DataTable, type DataTableColumn } from "@/components/admin/data-table";
import { Badge } from "@/components/admin/badge";
import { shipmentStatuses, shipmentStatusLabel, shipmentStatusTone } from "@/lib/status";

export interface ShipmentRow {
  id: string;
  orderId: string;
  orderNumber: string;
  customerName: string;
  carrier: string;
  trackingCode: string | null;
  status: string;
}

const inputClass =
  "w-full rounded-md border border-admin-border px-2 py-1.5 text-sm focus:border-admin-accent focus:outline-none focus:ring-1 focus:ring-admin-accent";

export function ShipmentsTable({
  shipments,
  updateAction
}: {
  shipments: ShipmentRow[];
  updateAction: (formData: FormData) => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);

  const columns: DataTableColumn<ShipmentRow>[] = [
    {
      key: "orderNumber",
      header: "Siparis No",
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
      key: "carrier",
      header: "Kargo Firmasi",
      render: (row) =>
        row.id === editingId ? (
          <form id={`ship-form-${row.id}`} action={updateAction}>
            <input type="hidden" name="shipmentId" value={row.id} />
            <input name="carrier" defaultValue={row.carrier} placeholder="Kargo Firmasi" className={inputClass} />
          </form>
        ) : (
          row.carrier || <span className="text-admin-text-muted">-</span>
        )
    },
    {
      key: "trackingCode",
      header: "Takip Kodu",
      render: (row) =>
        row.id === editingId ? (
          <input
            form={`ship-form-${row.id}`}
            name="trackingCode"
            defaultValue={row.trackingCode ?? ""}
            placeholder="Takip Kodu"
            className={inputClass}
          />
        ) : (
          row.trackingCode || <span className="text-admin-text-muted">-</span>
        )
    },
    {
      key: "status",
      header: "Durum",
      render: (row) =>
        row.id === editingId ? (
          <select form={`ship-form-${row.id}`} name="status" defaultValue={row.status} className={inputClass}>
            {shipmentStatuses.map((s) => (
              <option key={s} value={s}>
                {shipmentStatusLabel[s]}
              </option>
            ))}
          </select>
        ) : (
          <Badge tone={shipmentStatusTone[row.status as keyof typeof shipmentStatusTone]}>
            {shipmentStatusLabel[row.status as keyof typeof shipmentStatusLabel] ?? row.status}
          </Badge>
        )
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
              Vazgec
            </button>
            <button
              type="submit"
              form={`ship-form-${row.id}`}
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
            title="Duzenle"
          >
            <Pencil size={15} />
          </button>
        )
    }
  ];

  return (
    <DataTable
      columns={columns}
      data={shipments}
      getRowId={(row) => row.id}
      emptyTitle="Sonuc bulunamadi"
      emptyDescription="Arama veya filtre kriterlerine uygun kargo kaydi yok."
    />
  );
}
