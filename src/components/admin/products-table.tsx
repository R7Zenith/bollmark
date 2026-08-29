"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ImageOff } from "lucide-react";
import { DataTable, type DataTableColumn } from "@/components/admin/data-table";
import { Badge, type BadgeTone } from "@/components/admin/badge";
import type { BulkAction } from "@/components/admin/bulk-action-bar";
import { useToast } from "@/components/admin/toast";
import { formatPrice } from "@/lib/format";

export interface ProductRow {
  id: string;
  name: string;
  status: string;
  priceCents: number;
  stock: number;
  createdAt: string;
  imageUrl: string | null;
}

const statusLabel: Record<string, string> = { DRAFT: "Taslak", PUBLISHED: "Yayında", ARCHIVED: "Arşiv" };
const statusTone: Record<string, BadgeTone> = { DRAFT: "gray", PUBLISHED: "green", ARCHIVED: "gray-muted" };

async function bulkRequest(body: Record<string, unknown>) {
  const res = await fetch("/api/admin/urunler/bulk", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, error: data?.error as string | undefined };
}

export function ProductsTable({
  products,
  initialSort
}: {
  products: ProductRow[];
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
      showToast("Ürün durumu güncellendi.", "success");
      clearSelection();
      router.refresh();
    } else {
      showToast(error ?? "Bir hata oluştu.", "error");
    }
  }

  async function handleDelete(ids: string[], clearSelection: () => void) {
    if (!window.confirm(`${ids.length} ürünü silmek istediğinize emin misiniz?`)) return;
    const { ok, error } = await bulkRequest({ ids, action: "DELETE" });
    if (ok) {
      showToast("Ürünler silindi.", "success");
      clearSelection();
      router.refresh();
    } else {
      showToast(error ?? "Bir hata oluştu.", "error");
    }
  }

  const columns: DataTableColumn<ProductRow>[] = [
    {
      key: "name",
      header: "Ürün",
      sortable: true,
      render: (row) => (
        <Link href={`/admin/urunler/${row.id}`} className="flex items-center gap-3 hover:underline">
          <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-md border border-admin-border bg-admin-bg">
            {row.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={row.imageUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <ImageOff size={14} className="text-admin-text-muted" />
            )}
          </span>
          <span className="font-medium text-admin-text">{row.name}</span>
        </Link>
      )
    },
    {
      key: "status",
      header: "Durum",
      render: (row) => <Badge tone={statusTone[row.status]}>{statusLabel[row.status] ?? row.status}</Badge>
    },
    {
      key: "price",
      header: "Fiyat",
      sortable: true,
      align: "right",
      render: (row) => formatPrice(row.priceCents)
    },
    {
      key: "stock",
      header: "Stok",
      sortable: true,
      align: "right",
      render: (row) => row.stock
    },
    {
      key: "createdAt",
      header: "Oluşturulma",
      sortable: true,
      render: (row) => new Date(row.createdAt).toLocaleDateString("tr-TR")
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (row) => (
        <Link href={`/admin/urunler/${row.id}`} className="text-admin-accent hover:underline">
          Düzenle
        </Link>
      )
    }
  ];

  function bulkActions(selectedIds: string[], clearSelection: () => void): BulkAction[] {
    return [
      { label: "Yayına Al", variant: "secondary", onClick: () => handleStatusChange(selectedIds, "PUBLISHED", clearSelection) },
      { label: "Taslağa Al", variant: "secondary", onClick: () => handleStatusChange(selectedIds, "DRAFT", clearSelection) },
      { label: "Arşivle", variant: "secondary", onClick: () => handleStatusChange(selectedIds, "ARCHIVED", clearSelection) },
      { label: "Sil", variant: "danger", onClick: () => handleDelete(selectedIds, clearSelection) }
    ];
  }

  return (
    <DataTable
      columns={columns}
      data={products}
      getRowId={(row) => row.id}
      selectable
      bulkActions={bulkActions}
      onSortChange={handleSortChange}
      initialSort={initialSort}
      emptyTitle="Sonuç bulunamadı"
      emptyDescription="Arama veya filtre kriterlerine uygun ürün yok."
    />
  );
}
