"use client";

import Link from "next/link";
import { DataTable, type DataTableColumn } from "@/components/admin/data-table";
import { formatPrice } from "@/lib/format";

export interface CustomerRow {
  email: string;
  name: string;
  orderCount: number;
  totalSpentCents: number;
  lastOrderAt: string;
}

export function CustomersTable({ customers }: { customers: CustomerRow[] }) {
  const columns: DataTableColumn<CustomerRow>[] = [
    {
      key: "name",
      header: "Musteri",
      render: (row) => (
        <Link href={`/admin/siparisler?q=${encodeURIComponent(row.email)}`} className="font-medium text-admin-text hover:underline">
          {row.name}
        </Link>
      )
    },
    { key: "email", header: "E-posta", render: (row) => row.email },
    { key: "orderCount", header: "Siparis Sayisi", align: "right", render: (row) => row.orderCount },
    { key: "totalSpent", header: "Toplam Harcama", align: "right", render: (row) => formatPrice(row.totalSpentCents) },
    { key: "lastOrderAt", header: "Son Siparis", render: (row) => new Date(row.lastOrderAt).toLocaleDateString("tr-TR") }
  ];

  return (
    <DataTable
      columns={columns}
      data={customers}
      getRowId={(row) => row.email}
      emptyTitle="Sonuc bulunamadi"
      emptyDescription="Arama kriterine uygun musteri yok."
    />
  );
}
