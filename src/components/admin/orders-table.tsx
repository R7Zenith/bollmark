"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { DataTable, type DataTableColumn } from "@/components/admin/data-table";
import { Badge } from "@/components/admin/badge";
import type { BulkAction } from "@/components/admin/bulk-action-bar";
import { useToast } from "@/components/admin/toast";
import { formatPrice } from "@/lib/format";
import { orderStatusLabel, orderStatusTone, shipmentStatusLabel, shipmentStatusTone } from "@/lib/status";

export interface OrderRow {
  id: string;
  orderNumber: string;
  customerName: string;
  status: string;
  shipmentStatus: string | null;
  totalCents: number;
  createdAt: string;
  viewedAt: string | null;
}

async function bulkRequest(body: Record<string, unknown>) {
  const res = await fetch("/api/admin/siparisler/bulk", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, error: data?.error as string | undefined };
}

export function OrdersTable({
  orders,
  initialSort,
  canDelete = false
}: {
  orders: OrderRow[];
  initialSort?: { key: string; direction: "asc" | "desc" } | null;
  canDelete?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { showToast } = useToast();

  function handleSortChange(key: string, direction: "asc" | "desc") {
    const params = new URLSearchParams(searchParams.toString());
    params.set("sort", key);
    params.set("dir", direction);
    router.push(`${pathname}?${params.toString()}`);
  }

  async function handleStatusChange(ids: string[], status: string, clearSelection: () => void) {
    const { ok, error } = await bulkRequest({ ids, action: "SET_STATUS", status });
    if (ok) {
      showToast("Sipariş durumu güncellendi.", "success");
      clearSelection();
      router.refresh();
    } else {
      showToast(error ?? "Bir hata oluştu.", "error");
    }
  }

  async function handleDelete(ids: string[], clearSelection: () => void) {
    if (!window.confirm("Seçili siparişleri silmek istediğinize emin misiniz?")) return;
    const { ok, error } = await bulkRequest({ ids, action: "DELETE" });
    if (ok) {
      showToast("Seçili siparişler silindi.", "success");
      clearSelection();
      router.refresh();
    } else {
      showToast(error ?? "Bir hata oluştu.", "error");
    }
  }

  const columns: DataTableColumn<OrderRow>[] = [
    {
      key: "orderNumber",
      header: "Sipariş No",
      sortable: true,
      hideable: false,
      render: (row) => (
        <div className="flex items-center gap-2">
          <Link href={`/admin/siparisler/${row.id}`} className="font-mono font-medium text-admin-text hover:underline">
            {row.orderNumber}
          </Link>
          {row.viewedAt === null && <Badge tone="green">YENİ SİPARİŞ</Badge>}
        </div>
      )
    },
    {
      key: "customerName",
      header: "Müşteri",
      sortable: true,
      hideable: true,
      render: (row) => row.customerName
    },
    {
      key: "status",
      header: "Ödeme Durumu",
      hideable: true,
      render: (row) => (
        <Badge tone={orderStatusTone[row.status as keyof typeof orderStatusTone]}>
          {orderStatusLabel[row.status as keyof typeof orderStatusLabel] ?? row.status}
        </Badge>
      )
    },
    {
      key: "shipmentStatus",
      header: "Kargo Durumu",
      hideable: true,
      hideOnMobile: true,
      render: (row) =>
        row.shipmentStatus ? (
          <Badge tone={shipmentStatusTone[row.shipmentStatus as keyof typeof shipmentStatusTone]}>
            {shipmentStatusLabel[row.shipmentStatus as keyof typeof shipmentStatusLabel] ?? row.shipmentStatus}
          </Badge>
        ) : (
          <Badge tone="gray">Kargo Yok</Badge>
        )
    },
    {
      key: "total",
      header: "Tutar",
      sortable: true,
      align: "right",
      hideable: false,
      render: (row) => formatPrice(row.totalCents)
    },
    {
      key: "createdAt",
      header: "Tarih",
      sortable: true,
      hideable: true,
      hideOnMobile: true,
      render: (row) => new Date(row.createdAt).toLocaleDateString("tr-TR")
    },
    {
      key: "actions",
      header: "",
      align: "right",
      hideable: false,
      render: (row) => (
        <Link href={`/admin/siparisler/${row.id}`} className="text-admin-accent hover:underline">
          Detay
        </Link>
      )
    }
  ];

  function bulkActions(selectedIds: string[], clearSelection: () => void): BulkAction[] {
    return [
      {
        label: "Ödendi Olarak İşaretle",
        variant: "secondary",
        onClick: () => handleStatusChange(selectedIds, "PAID", clearSelection)
      },
      {
        label: "Hazırlanıyor Olarak İşaretle",
        variant: "secondary",
        onClick: () => handleStatusChange(selectedIds, "PREPARING", clearSelection)
      },
      {
        label: "İptal Et",
        variant: "danger",
        onClick: () => handleStatusChange(selectedIds, "CANCELLED", clearSelection)
      },
      ...(canDelete
        ? [
            {
              label: "Sil",
              variant: "danger" as const,
              onClick: () => handleDelete(selectedIds, clearSelection)
            }
          ]
        : [])
    ];
  }

  return (
    <DataTable
      columns={columns}
      data={orders}
      getRowId={(row) => row.id}
      selectable
      bulkActions={bulkActions}
      onSortChange={handleSortChange}
      initialSort={initialSort}
      emptyTitle="Sonuç bulunamadı"
      emptyDescription="Arama veya filtre kriterlerine uygun sipariş yok."
      columnVisibilityStorageKey="admin-table-columns:siparisler"
    />
  );
}
