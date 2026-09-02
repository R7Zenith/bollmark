"use client";

import { DataTable, type DataTableColumn } from "@/components/admin/data-table";
import { formatPrice } from "@/lib/format";

export interface BreakdownRow {
  key: string;
  name: string;
  quantity: number;
  revenueCents: number;
}

export function BreakdownTable({ rows }: { rows: BreakdownRow[] }) {
  const columns: DataTableColumn<BreakdownRow>[] = [
    { key: "name", header: "Ad", render: (r) => r.name },
    { key: "quantity", header: "Satılan Adet", align: "right", render: (r) => r.quantity },
    { key: "revenueCents", header: "Ciro", align: "right", render: (r) => formatPrice(r.revenueCents) }
  ];

  return <DataTable columns={columns} data={rows} getRowId={(r) => r.key} emptyTitle="Bu dönemde satış yok" />;
}
