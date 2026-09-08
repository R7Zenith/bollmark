"use client";

import { Mail } from "lucide-react";
import { DataTable, type DataTableColumn } from "@/components/admin/data-table";
import { Badge } from "@/components/admin/badge";
import { ConfirmSubmitButton } from "@/components/admin/confirm-submit-button";
import { formatPrice } from "@/lib/format";
import { abandonedCartStatusLabel, abandonedCartStatusTone, type AbandonedCartStatus } from "@/lib/status";

export interface AbandonedCartRow {
  id: string;
  email: string;
  itemsSummary: string;
  itemCount: number;
  totalCents: number;
  status: AbandonedCartStatus;
  createdAtLabel: string;
  remindedAtLabel: string | null;
  canResend: boolean;
}

export function AbandonedCartsTable({
  carts,
  resendAction
}: {
  carts: AbandonedCartRow[];
  resendAction: (formData: FormData) => void;
}) {
  const columns: DataTableColumn<AbandonedCartRow>[] = [
    {
      key: "email",
      header: "E-posta",
      render: (row) => <span className="font-medium text-admin-text">{row.email}</span>
    },
    {
      key: "items",
      header: "Sepet İçeriği",
      render: (row) => (
        <div className="max-w-xs">
          <p className="truncate text-admin-text-muted" title={row.itemsSummary}>
            {row.itemsSummary}
          </p>
          <p className="text-xs text-admin-text-muted">{row.itemCount} ürün</p>
        </div>
      )
    },
    {
      key: "total",
      header: "Toplam",
      align: "right",
      render: (row) => <span className="font-medium text-admin-text">{formatPrice(row.totalCents)}</span>
    },
    {
      key: "status",
      header: "Durum",
      render: (row) => (
        <div>
          <Badge tone={abandonedCartStatusTone[row.status]}>{abandonedCartStatusLabel[row.status]}</Badge>
          {row.remindedAtLabel && (
            <p className="mt-1 text-xs text-admin-text-muted">Son hatırlatma: {row.remindedAtLabel}</p>
          )}
        </div>
      )
    },
    {
      key: "createdAt",
      header: "Tarih",
      render: (row) => <span className="text-admin-text-muted">{row.createdAtLabel}</span>
    },
    {
      key: "actions",
      header: "",
      align: "right",
      hideable: false,
      render: (row) =>
        row.canResend ? (
          <form action={resendAction}>
            <input type="hidden" name="cartId" value={row.id} />
            <ConfirmSubmitButton
              confirmMessage={`${row.email} adresine şimdi hatırlatma e-postası gönderilsin mi?`}
              className="flex items-center gap-1.5 rounded-md border border-admin-border px-3 py-1.5 text-xs font-medium text-admin-text hover:bg-admin-bg"
            >
              <Mail size={13} />
              Hatırlatma Gönder
            </ConfirmSubmitButton>
          </form>
        ) : (
          <span className="text-xs text-admin-text-muted">-</span>
        )
    }
  ];

  return (
    <DataTable
      columns={columns}
      data={carts}
      getRowId={(row) => row.id}
      emptyTitle="Sonuç bulunamadı"
      emptyDescription="Arama veya filtre kriterlerine uygun terk edilmiş sepet yok."
    />
  );
}
