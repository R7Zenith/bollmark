"use client";

import { DataTable, type DataTableColumn } from "@/components/admin/data-table";
import { formatPrice } from "@/lib/format";

export interface TopProductRow {
  productId: string;
  name: string;
  quantity: number;
  revenueCents: number;
  marginPercent: number | null;
}

export function TopProductsTable({ products }: { products: TopProductRow[] }) {
  const columns: DataTableColumn<TopProductRow>[] = [
    { key: "name", header: "Ürün", render: (r) => r.name },
    { key: "quantity", header: "Satılan Adet", align: "right", render: (r) => r.quantity },
    { key: "revenueCents", header: "Ciro", align: "right", render: (r) => formatPrice(r.revenueCents) },
    {
      key: "marginPercent",
      header: "Kâr Marjı",
      align: "right",
      render: (r) => (r.marginPercent === null ? "-" : `%${r.marginPercent}`)
    }
  ];

  return (
    <DataTable columns={columns} data={products} getRowId={(r) => r.productId} emptyTitle="Bu dönemde satış yok" />
  );
}
