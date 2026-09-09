"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { DataTable, type DataTableColumn } from "@/components/admin/data-table";
import type { BulkAction } from "@/components/admin/bulk-action-bar";
import { Button } from "@/components/admin/button";
import { useToast } from "@/components/admin/toast";
import { formatPrice } from "@/lib/format";

export interface DeletedOrderRow {
  id: string;
  orderNumber: string;
  customerName: string;
  totalCents: number;
  deletedAt: string;
  deletedByEmail: string | null;
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

export function DeletedOrdersTable({ orders }: { orders: DeletedOrderRow[] }) {
  const router = useRouter();
  const { showToast } = useToast();

  async function handleRestore(ids: string[], clearSelection: () => void) {
    const { ok, error } = await bulkRequest({ ids, action: "RESTORE" });
    if (ok) {
      showToast("Seçili siparişler geri yüklendi.", "success");
      clearSelection();
      router.refresh();
    } else {
      showToast(error ?? "Bir hata oluştu.", "error");
    }
  }

  const columns: DataTableColumn<DeletedOrderRow>[] = [
    {
      key: "orderNumber",
      header: "Sipariş No",
      sortable: false,
      hideable: false,
      render: (row) => (
        <Link href={`/admin/siparisler/${row.id}`} className="font-mono font-medium text-admin-text hover:underline">
          {row.orderNumber}
        </Link>
      )
    },
    {
      key: "customerName",
      header: "Müşteri",
      hideable: true,
      render: (row) => row.customerName
    },
    {
      key: "total",
      header: "Tutar",
      align: "right",
      hideable: false,
      render: (row) => formatPrice(row.totalCents)
    },
    {
      key: "deletedAt",
      header: "Silinme Tarihi",
      hideable: true,
      render: (row) => new Date(row.deletedAt).toLocaleDateString("tr-TR")
    },
    {
      key: "deletedByEmail",
      header: "Silen",
      hideable: true,
      hideOnMobile: true,
      render: (row) => row.deletedByEmail ?? "-"
    },
    {
      key: "actions",
      header: "",
      align: "right",
      hideable: false,
      render: (row) => <RowRestoreButton orderId={row.id} onDone={() => router.refresh()} />
    }
  ];

  function bulkActions(selectedIds: string[], clearSelection: () => void): BulkAction[] {
    return [
      {
        label: "Geri Yükle",
        variant: "secondary",
        onClick: () => handleRestore(selectedIds, clearSelection)
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
      emptyTitle="Silinmiş sipariş yok"
      columnVisibilityStorageKey="admin-table-columns:silinen-siparisler"
    />
  );
}

function RowRestoreButton({ onDone, orderId }: { orderId: string; onDone: () => void }) {
  const { showToast } = useToast();

  async function handleClick() {
    const { ok, error } = await bulkRequest({ ids: [orderId], action: "RESTORE" });
    if (ok) {
      showToast("Sipariş geri yüklendi.", "success");
      onDone();
    } else {
      showToast(error ?? "Bir hata oluştu.", "error");
    }
  }

  return (
    <Button type="button" variant="secondary" size="sm" onClick={handleClick}>
      Geri Yükle
    </Button>
  );
}
