"use client";

import Link from "next/link";
import { DataTable, type DataTableColumn } from "@/components/admin/data-table";
import { Badge } from "@/components/admin/badge";
import { contactStatusLabel, contactStatusTone, type ContactStatus } from "@/lib/status";

export interface MessageRow {
  id: string;
  createdAtLabel: string;
  fullName: string;
  email: string;
  firstLine: string;
  status: string;
}

export function MessagesTable({ messages }: { messages: MessageRow[] }) {
  const columns: DataTableColumn<MessageRow>[] = [
    {
      key: "createdAt",
      header: "Tarih",
      render: (row) => <span className="whitespace-nowrap text-admin-text-muted">{row.createdAtLabel}</span>
    },
    {
      key: "name",
      header: "Ad Soyad",
      render: (row) => (
        <Link
          href={`/admin/mesajlar/${row.id}`}
          className={`text-admin-text hover:underline ${row.status === "YENI" ? "font-semibold" : "font-medium"}`}
        >
          {row.fullName}
        </Link>
      )
    },
    {
      key: "email",
      header: "E-posta",
      hideOnMobile: true,
      render: (row) => <span className="text-admin-text-muted">{row.email}</span>
    },
    {
      key: "message",
      header: "Mesaj",
      render: (row) => (
        <Link href={`/admin/mesajlar/${row.id}`} className="block max-w-xs truncate text-admin-text-muted hover:text-admin-text">
          {row.firstLine}
        </Link>
      )
    },
    {
      key: "status",
      header: "Durum",
      render: (row) => (
        <Badge tone={contactStatusTone[row.status as ContactStatus]}>
          {contactStatusLabel[row.status as ContactStatus] ?? row.status}
        </Badge>
      )
    }
  ];

  return (
    <DataTable
      columns={columns}
      data={messages}
      getRowId={(row) => row.id}
      emptyTitle="Mesaj bulunamadı"
      emptyDescription="Seçili duruma uygun mesaj yok."
    />
  );
}
