"use client";

import { DataTable, type DataTableColumn } from "@/components/admin/data-table";
import { Badge } from "@/components/admin/badge";
import { reviewStatuses, reviewStatusLabel, reviewStatusTone } from "@/lib/review-constants";

export interface ReviewRow {
  id: string;
  productName: string;
  customerName: string;
  rating: number;
  comment: string;
  hasImages: boolean;
  status: string;
  createdAtLabel: string;
}

const selectClass =
  "rounded-md border border-admin-border px-2 py-1.5 text-sm focus:border-admin-accent focus:outline-none focus:ring-1 focus:ring-admin-accent";

export function ReviewsTable({
  reviews,
  updateAction
}: {
  reviews: ReviewRow[];
  updateAction: (formData: FormData) => void;
}) {
  const columns: DataTableColumn<ReviewRow>[] = [
    {
      key: "product",
      header: "Ürün",
      render: (row) => (
        <div>
          <p className="font-medium text-admin-text">{row.productName}</p>
          <p className="text-xs text-admin-text-muted">{row.customerName} · {row.createdAtLabel}</p>
        </div>
      )
    },
    { key: "rating", header: "Puan", align: "center", render: (row) => `${row.rating} / 5` },
    {
      key: "comment",
      header: "Yorum",
      render: (row) => (
        <div>
          <p className="max-w-md truncate text-admin-text">{row.comment}</p>
          {row.hasImages && <span className="text-xs text-admin-text-muted">Fotoğraflı</span>}
        </div>
      )
    },
    {
      key: "status",
      header: "Durum",
      render: (row) => (
        <form action={updateAction} className="flex items-center gap-2">
          <input type="hidden" name="reviewId" value={row.id} />
          <select name="status" defaultValue={row.status} className={selectClass} onChange={(e) => e.currentTarget.form?.requestSubmit()}>
            {reviewStatuses.map((s) => (
              <option key={s} value={s}>
                {reviewStatusLabel[s]}
              </option>
            ))}
          </select>
          <Badge tone={reviewStatusTone[row.status as keyof typeof reviewStatusTone]}>
            {reviewStatusLabel[row.status as keyof typeof reviewStatusLabel] ?? row.status}
          </Badge>
        </form>
      )
    }
  ];

  return (
    <DataTable
      columns={columns}
      data={reviews}
      getRowId={(row) => row.id}
      emptyTitle="Sonuç bulunamadı"
      emptyDescription="Arama veya filtre kriterlerine uygun yorum yok."
    />
  );
}
