"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { DataTable, type DataTableColumn } from "@/components/admin/data-table";
import { Badge } from "@/components/admin/badge";
import type { BulkAction } from "@/components/admin/bulk-action-bar";
import { useToast } from "@/components/admin/toast";
import { shipmentStatuses, shipmentStatusLabel, shipmentStatusTone } from "@/lib/status";

export interface ShipmentRow {
  id: string;
  orderId: string;
  orderNumber: string;
  customerName: string;
  carrier: string;
  trackingCode: string | null;
  status: string;
  // Yurtici: aktif gonderide Yurtici durum etiketi, degilse null
  yurticiLabel: string | null;
  yurticiActive: boolean;
}

export type YurticiBulkResult = { sent: string[]; failed: { orderNumber: string; message: string }[] };

const inputClass =
  "w-full rounded-md border border-admin-border px-2 py-1.5 text-sm focus:border-admin-accent focus:outline-none focus:ring-1 focus:ring-admin-accent";

export function ShipmentsTable({
  shipments,
  updateAction,
  yurticiSendAction
}: {
  shipments: ShipmentRow[];
  updateAction: (formData: FormData) => void;
  // Yurtici kapaliyken (YURTICI_MODE=off) verilmez; secim ve toplu islemler gizlenir.
  yurticiSendAction?: (shipmentIds: string[]) => Promise<YurticiBulkResult>;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const { showToast } = useToast();

  async function handleYurticiSend(ids: string[], clearSelection: () => void) {
    if (!yurticiSendAction || busy) return;
    setBusy(true);
    try {
      const { sent, failed } = await yurticiSendAction(ids);
      if (failed.length === 0) {
        showToast(`${sent.length} sipariş Yurtiçi'ye gönderildi.`, "success");
      } else {
        const detail = failed.map((f) => `${f.orderNumber}: ${f.message}`).join(" · ");
        showToast(`${sent.length} gönderildi, ${failed.length} gönderilemedi. ${detail}`, sent.length ? "success" : "error");
      }
      clearSelection();
      router.refresh();
    } catch {
      showToast("Yurtiçi'ye gönderilemedi.", "error");
    } finally {
      setBusy(false);
    }
  }

  function bulkActions(ids: string[], clearSelection: () => void): BulkAction[] {
    return [
      { label: busy ? "Gönderiliyor..." : "Yurtiçi'ye gönder", variant: "primary", onClick: () => handleYurticiSend(ids, clearSelection) },
      {
        label: "Etiket yazdır (A4, 4'lü)",
        variant: "secondary",
        onClick: () => window.open(`/admin/kargolar/etiket?boyut=a4&ids=${ids.join(",")}`, "_blank")
      }
    ];
  }

  const columns: DataTableColumn<ShipmentRow>[] = [
    {
      key: "orderNumber",
      header: "Sipariş No",
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
      header: "Kargo Firması",
      render: (row) =>
        row.id === editingId ? (
          <form id={`ship-form-${row.id}`} action={updateAction}>
            <input type="hidden" name="shipmentId" value={row.id} />
            <input name="carrier" defaultValue={row.carrier} placeholder="Kargo Firması" className={inputClass} />
          </form>
        ) : (
          row.carrier || <span className="text-admin-text-muted">-</span>
        )
    },
    {
      key: "trackingCode",
      header: "Takip Kodu",
      hideOnMobile: true,
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
    ...(yurticiSendAction
      ? [
          {
            key: "yurtici",
            header: "Yurtiçi",
            hideOnMobile: true,
            render: (row: ShipmentRow) =>
              row.yurticiLabel ? (
                <span className={row.yurticiActive ? "text-admin-text" : "text-admin-text-muted"}>{row.yurticiLabel}</span>
              ) : (
                <span className="text-admin-text-muted">-</span>
              )
          }
        ]
      : []),
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
      data={shipments}
      getRowId={(row) => row.id}
      selectable={!!yurticiSendAction}
      bulkActions={yurticiSendAction ? bulkActions : undefined}
      emptyTitle="Sonuç bulunamadı"
      emptyDescription="Arama veya filtre kriterlerine uygun kargo kaydı yok."
    />
  );
}
