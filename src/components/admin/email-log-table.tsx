"use client";

import Link from "next/link";
import { DataTable, type DataTableColumn } from "@/components/admin/data-table";
import { Badge } from "@/components/admin/badge";

export interface EmailLogRow {
  id: string;
  createdAtLabel: string;
  to: string;
  kindLabel: string;
  subject: string;
  sent: boolean;
}

export function EmailLogTable({ rows }: { rows: EmailLogRow[] }) {
  const columns: DataTableColumn<EmailLogRow>[] = [
    {
      key: "createdAt",
      header: "Tarih",
      render: (row) => <span className="whitespace-nowrap text-admin-text-muted">{row.createdAtLabel}</span>
    },
    {
      key: "to",
      header: "Alıcı",
      render: (row) => (
        <Link href={`/admin/giden-mailler?q=${encodeURIComponent(row.to)}`} className="break-all text-admin-text hover:underline">
          {row.to}
        </Link>
      )
    },
    {
      key: "kind",
      header: "Tür",
      hideOnMobile: true,
      render: (row) => <span className="whitespace-nowrap text-admin-text-muted">{row.kindLabel}</span>
    },
    {
      key: "subject",
      header: "Konu",
      render: (row) => (
        <Link href={`/admin/giden-mailler/${row.id}`} className="block max-w-sm truncate font-medium text-admin-text hover:underline">
          {row.subject}
        </Link>
      )
    },
    {
      key: "status",
      header: "Durum",
      render: (row) => <Badge tone={row.sent ? "green" : "red"}>{row.sent ? "Gönderildi" : "Gönderilemedi"}</Badge>
    }
  ];

  return <DataTable columns={columns} data={rows} getRowId={(row) => row.id} emptyTitle="Bu filtreye uyan mail yok" />;
}
