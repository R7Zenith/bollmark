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
  initialSort
}: {
  orders: OrderRow[];
  initialSort?: { key: string; direction: "asc" | "desc" } | null;
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
      showToast("Siparis durumu guncellendi.", "success");
      clearSelection();
      router.refresh();
    } else {
      showToast(error ?? "Bir hata olustu.", "error");
    }
  }

  const columns: DataTableColumn<OrderRow>[] = [
    {
      key: "orderNumber",
      header: "Siparis No",
      sortable: true,
      render: (row) => (
        <Link href={`/admin/siparisler/${row.id}`} className="font-mono font-medium text-admin-text hover:underline">
          {row.orderNumber}
        </Link>
      )
    },
    {
      key: "customerName",
      header: "Musteri",
      sortable: true,
      render: (row) => row.customerName
    },
    {
      key: "status",
      header: "Odeme Durumu",
      render: (row) => (
        <Badge tone={orderStatusTone[row.status as keyof typeof orderStatusTone]}>
          {orderStatusLabel[row.status as keyof typeof orderStatusLabel] ?? row.status}
        </Badge>
      )
    },
    {
      key: "shipmentStatus",
      header: "Kargo Durumu",
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
      render: (row) => formatPrice(row.totalCents)
    },
    {
      key: "createdAt",
      header: "Tarih",
      sortable: true,
      render: (row) => new Date(row.createdAt).toLocaleDateString("tr-TR")
    },
    {
      key: "actions",
      header: "",
      align: "right",
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
        label: "Odendi Olarak Isaretle",
        variant: "secondary",
        onClick: () => handleStatusChange(selectedIds, "PAID", clearSelection)
      },
      {
        label: "Hazirlaniyor Olarak Isaretle",
        variant: "secondary",
        onClick: () => handleStatusChange(selectedIds, "PREPARING", clearSelection)
      },
      {
        label: "Iptal Et",
        variant: "danger",
        onClick: () => handleStatusChange(selectedIds, "CANCELLED", clearSelection)
      }
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
      emptyTitle="Sonuc bulunamadi"
      emptyDescription="Arama veya filtre kriterlerine uygun siparis yok."
    />
  );
}
