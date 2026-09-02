"use client";

import Link from "next/link";
import { DataTable, type DataTableColumn } from "@/components/admin/data-table";
import { Badge } from "@/components/admin/badge";
import { CustomerPointsAdjust } from "@/components/admin/customer-points-adjust";
import { formatPrice } from "@/lib/format";

export interface CustomerRow {
  id: string | null;
  email: string;
  name: string;
  orderCount: number;
  totalSpentCents: number;
  lastOrderAt: string;
  hasAccount: boolean;
  loyaltyPoints: number | null;
}

export function CustomersTable({ customers }: { customers: CustomerRow[] }) {
  const columns: DataTableColumn<CustomerRow>[] = [
    {
      key: "name",
      header: "Müşteri",
      render: (row) => (
        <div>
          <Link href={`/admin/siparisler?q=${encodeURIComponent(row.email)}`} className="font-medium text-admin-text hover:underline">
            {row.name}
          </Link>
          {row.hasAccount && (
            <span className="ml-2">
              <Badge tone="blue">Hesaplı</Badge>
            </span>
          )}
        </div>
      )
    },
    { key: "email", header: "E-posta", render: (row) => row.email },
    { key: "orderCount", header: "Sipariş Sayısı", align: "right", render: (row) => row.orderCount },
    { key: "totalSpent", header: "Toplam Harcama", align: "right", render: (row) => formatPrice(row.totalSpentCents) },
    {
      key: "loyaltyPoints",
      header: "Puan",
      align: "right",
      render: (row) => (row.hasAccount ? row.loyaltyPoints : <span className="text-admin-text-muted">-</span>)
    },
    { key: "lastOrderAt", header: "Son Sipariş", render: (row) => new Date(row.lastOrderAt).toLocaleDateString("tr-TR") },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (row) => (row.hasAccount && row.id ? <CustomerPointsAdjust customerId={row.id} /> : null)
    }
  ];

  return (
    <DataTable
      columns={columns}
      data={customers}
      getRowId={(row) => row.email}
      emptyTitle="Sonuç bulunamadı"
      emptyDescription="Arama kriterine uygun müşteri yok."
    />
  );
}
