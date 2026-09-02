"use client";

import { DataTable, type DataTableColumn } from "@/components/admin/data-table";
import { auditActionLabel } from "@/lib/audit-actions";

export interface AuditLogRow {
  id: string;
  actorEmail: string;
  action: string;
  targetType: string;
  targetId: string;
  detail: string | null;
  createdAtLabel: string;
}

export function AuditLogTable({ logs }: { logs: AuditLogRow[] }) {
  const columns: DataTableColumn<AuditLogRow>[] = [
    {
      key: "createdAt",
      header: "Tarih",
      render: (row) => <span className="text-admin-text-muted">{row.createdAtLabel}</span>
    },
    {
      key: "actorEmail",
      header: "Aktör",
      render: (row) => <span className="text-admin-text">{row.actorEmail}</span>
    },
    {
      key: "action",
      header: "Aksiyon",
      render: (row) => <span className="text-admin-text">{auditActionLabel[row.action] ?? row.action}</span>
    },
    {
      key: "target",
      header: "Hedef",
      render: (row) => (
        <span className="font-mono text-xs text-admin-text-muted">
          {row.targetType}#{row.targetId.slice(0, 8)}
        </span>
      )
    },
    {
      key: "detail",
      header: "Detay",
      render: (row) => row.detail || <span className="text-admin-text-muted">-</span>
    }
  ];

  return (
    <DataTable
      columns={columns}
      data={logs}
      getRowId={(row) => row.id}
      emptyTitle="Sonuç bulunamadı"
      emptyDescription="Arama veya filtre kriterlerine uygun işlem kaydı yok."
    />
  );
}
