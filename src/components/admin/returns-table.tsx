"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Pencil } from "lucide-react";
import { DataTable, type DataTableColumn } from "@/components/admin/data-table";
import { Badge } from "@/components/admin/badge";
import { formatPrice } from "@/lib/format";
import { STORE_INFO } from "@/lib/store-info";
import { returnStatuses, returnStatusLabel, returnStatusTone, returnTypeLabel } from "@/lib/status";

export interface ReturnRow {
  id: string;
  orderId: string;
  orderNumber: string;
  customerName: string;
  type: string;
  reason: string;
  itemsSummary: string;
  status: string;
  adminNote: string | null;
  customerNote: string | null;
  customerReply: string | null;
  customerReplyAtLabel: string | null;
  createdAtLabel: string;
  kalp: {
    labels: string[];
    canPickExchange: boolean;
    exchangeSku: string | null;
    diffCents: number | null;
    diffSettled: boolean;
  } | null;
}

function KalpReturnInfo({
  row,
  exchangeAction,
  settleAction
}: {
  row: ReturnRow;
  exchangeAction: (formData: FormData) => void;
  settleAction: (formData: FormData) => void;
}) {
  const kalp = row.kalp;
  if (!kalp) return null;
  const diff = kalp.diffCents;
  return (
    <div className="mt-1 space-y-1 text-xs text-admin-text-muted">
      {kalp.labels.map((label) => (
        <p key={label}>{label}</p>
      ))}
      {kalp.canPickExchange && (
        <form action={exchangeAction} className="flex gap-1">
          <input type="hidden" name="returnId" value={row.id} />
          <input
            name="sku"
            required
            defaultValue={kalp.exchangeSku ?? ""}
            placeholder="Değişim stok kodu"
            className="w-36 rounded-md border border-admin-border px-2 py-1 text-xs"
          />
          <button type="submit" className="rounded-md border border-admin-border px-2 py-1 text-xs text-admin-text hover:bg-admin-bg">
            Hesapla
          </button>
        </form>
      )}
      {diff !== null && (
        <p className="font-medium text-admin-text">
          {diff === 0 ? "Fark yok" : `${diff > 0 ? "Müşteriden alınacak" : "Müşteriye ödenecek"}: ${formatPrice(Math.abs(diff))}`}
        </p>
      )}
      {diff !== null && diff !== 0 && !kalp.diffSettled && (
        <form action={settleAction}>
          <input type="hidden" name="returnId" value={row.id} />
          <button type="submit" className="rounded-md border border-admin-border px-2 py-1 text-xs text-admin-text hover:bg-admin-bg">
            {diff > 0 ? "Fark tahsil edildi" : "Fark iade edildi"}
          </button>
        </form>
      )}
      {diff !== null && diff !== 0 && kalp.diffSettled && <p>Fark kapatıldı</p>}
    </div>
  );
}

const inputClass =
  "w-full rounded-md border border-admin-border px-2 py-1.5 text-sm focus:border-admin-accent focus:outline-none focus:ring-1 focus:ring-admin-accent";

// Hazir yanitlar (IADE_TALEBI_SISTEMI_PLANI.md 4.3): secilince alana dolar, duzenlenebilir.
const REPLY_TEMPLATES = [
  {
    label: "Onaylandı, kodla gönderebilirsiniz",
    text: `Talebini onayladık. Ürünü en yakın ${STORE_INFO.returnCarrier} şubesinden anlaşmalı iade kodumuzla ücretsiz gönderebilirsin. Kod ve gönderim adresi hesabında ve e-postanda yazıyor.`
  },
  {
    label: "Fotoğraf rica ediyoruz",
    text: `Talebini değerlendirebilmemiz için ürünün ve sorunun net göründüğü birkaç fotoğrafı sipariş numaranla birlikte ${STORE_INFO.email} adresine gönderebilir misin?`
  },
  {
    label: "Ürün elimize ulaştı",
    text: "Ürün elimize ulaştı, kontrolünü yapıyoruz. Tamamlanınca sana haber vereceğiz."
  },
  {
    label: "Reddedildi – sebep",
    text: "Talebini maalesef onaylayamadık. Sebep: [sebebi yazın]"
  }
];

function ReturnEditPanel({
  row,
  updateAction,
  onCancel
}: {
  row: ReturnRow;
  updateAction: (formData: FormData) => void;
  onCancel: () => void;
}) {
  const [reply, setReply] = useState(row.customerReply ?? "");
  const panelRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    panelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [row.id]);

  return (
    <form
      ref={panelRef}
      action={updateAction}
      className="mb-4 scroll-mt-20 rounded-lg border border-admin-border bg-admin-surface p-4 md:p-6"
    >
      <input type="hidden" name="returnId" value={row.id} />
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold text-admin-text">
          {row.orderNumber} · {returnTypeLabel[row.type as keyof typeof returnTypeLabel] ?? row.type}
        </h2>
        <span className="text-xs text-admin-text-muted">
          {row.customerName} · {row.createdAtLabel}
        </span>
      </div>

      <dl className="mt-4 grid gap-3 text-sm md:grid-cols-3">
        <div>
          <dt className="text-xs text-admin-text-muted">Sebep</dt>
          <dd className="text-admin-text">{row.reason}</dd>
        </div>
        <div className="md:col-span-2">
          <dt className="text-xs text-admin-text-muted">Ürünler</dt>
          <dd className="text-admin-text">{row.itemsSummary}</dd>
        </div>
        <div className="md:col-span-3">
          <dt className="text-xs text-admin-text-muted">Müşteri notu</dt>
          <dd className="whitespace-pre-line text-admin-text">{row.customerNote || "-"}</dd>
        </div>
      </dl>

      <div className="mt-5 grid gap-4 md:grid-cols-[200px_1fr]">
        <label className="block text-xs font-medium text-admin-text">
          Durum
          <select name="status" defaultValue={row.status} className={`${inputClass} mt-1`}>
            {returnStatuses.map((s) => (
              <option key={s} value={s}>
                {returnStatusLabel[s]}
              </option>
            ))}
          </select>
        </label>

        <div>
          <div className="flex flex-wrap items-end justify-between gap-2">
            <label htmlFor={`reply-${row.id}`} className="text-xs font-medium text-admin-text">
              Müşteriye yanıt <span className="font-normal text-admin-text-muted">(müşteri görür, mail gider)</span>
            </label>
            <select
              aria-label="Hazır yanıt seç"
              value=""
              onChange={(e) => {
                const template = REPLY_TEMPLATES.find((t) => t.label === e.target.value);
                if (template) setReply(template.text);
              }}
              className="rounded-md border border-admin-border px-2 py-1 text-xs text-admin-text"
            >
              <option value="">Hazır yanıt seç…</option>
              {REPLY_TEMPLATES.map((t) => (
                <option key={t.label} value={t.label}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <textarea
            id={`reply-${row.id}`}
            name="customerReply"
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            rows={4}
            placeholder="Müşterinin hesabında ve mailde görünecek yanıt"
            className={`${inputClass} mt-1`}
          />
          {row.customerReplyAtLabel && (
            <p className="mt-1 text-xs text-admin-text-muted">Son yanıt: {row.customerReplyAtLabel}</p>
          )}
        </div>

        <label className="block text-xs font-medium text-admin-text md:col-start-2">
          İç not <span className="font-normal text-admin-text-muted">(yalnız panelde, müşteri görmez)</span>
          <textarea name="adminNote" defaultValue={row.adminNote ?? ""} rows={2} placeholder="Not ekle" className={`${inputClass} mt-1`} />
        </label>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-end gap-3">
        <p className="mr-auto text-xs text-admin-text-muted">
          Durum değişirse durum maili gider, yanıt da içinde olur. Yalnız yanıt değişirse yanıt maili gider.
        </p>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-admin-border px-3 py-1.5 text-xs font-medium text-admin-text hover:bg-admin-bg"
        >
          Vazgeç
        </button>
        <button type="submit" className="rounded-md bg-admin-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700">
          Kaydet
        </button>
      </div>
    </form>
  );
}

export function ReturnsTable({
  returns,
  updateAction,
  exchangeAction,
  settleAction
}: {
  returns: ReturnRow[];
  updateAction: (formData: FormData) => void;
  exchangeAction: (formData: FormData) => void;
  settleAction: (formData: FormData) => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const editingRow = returns.find((row) => row.id === editingId) ?? null;

  const columns: DataTableColumn<ReturnRow>[] = [
    {
      key: "orderNumber",
      header: "Sipariş",
      render: (row) => (
        <div>
          <Link href={`/admin/siparisler/${row.orderId}`} className="font-mono font-medium text-admin-text hover:underline">
            {row.orderNumber}
          </Link>
          <p className="text-xs text-admin-text-muted">{row.customerName}</p>
          {row.status === "TAMAMLANDI" && (
            <Link href={`/admin/siparisler/${row.orderId}#odeme`} className="text-xs text-admin-accent hover:underline">
              Ödeme kartı / iade →
            </Link>
          )}
        </div>
      )
    },
    {
      key: "type",
      header: "Tip / Sebep",
      render: (row) => (
        <div>
          <p className="text-admin-text">{returnTypeLabel[row.type as keyof typeof returnTypeLabel] ?? row.type}</p>
          <p className="text-xs text-admin-text-muted">{row.reason}</p>
          {row.customerNote && <p className="mt-1 max-w-xs text-xs text-admin-text-muted">Müşteri notu: {row.customerNote}</p>}
          <KalpReturnInfo row={row} exchangeAction={exchangeAction} settleAction={settleAction} />
        </div>
      )
    },
    {
      key: "items",
      header: "Ürünler",
      hideOnMobile: true,
      render: (row) => <span className="text-admin-text-muted">{row.itemsSummary}</span>
    },
    {
      key: "status",
      header: "Durum",
      render: (row) => (
        <Badge tone={returnStatusTone[row.status as keyof typeof returnStatusTone]}>
          {returnStatusLabel[row.status as keyof typeof returnStatusLabel] ?? row.status}
        </Badge>
      )
    },
    {
      key: "adminNote",
      header: "Yanıt / İç not",
      render: (row) =>
        row.customerReply || row.adminNote ? (
          <div className="max-w-xs space-y-1 text-xs">
            {row.customerReply && <p className="line-clamp-2 text-admin-text">Yanıt: {row.customerReply}</p>}
            {row.adminNote && <p className="line-clamp-2 text-admin-text-muted">İç not: {row.adminNote}</p>}
          </div>
        ) : (
          <span className="text-admin-text-muted">-</span>
        )
    },
    {
      key: "createdAt",
      header: "Tarih",
      hideOnMobile: true,
      render: (row) => <span className="text-admin-text-muted">{row.createdAtLabel}</span>
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (row) => (
        <button
          type="button"
          onClick={() => setEditingId(row.id)}
          className="rounded-md p-1.5 text-admin-text-muted hover:bg-admin-bg"
          title="Düzenle"
          aria-label={`${row.orderNumber} talebini düzenle`}
        >
          <Pencil size={15} />
        </button>
      )
    }
  ];

  return (
    <>
      {editingRow && <ReturnEditPanel key={editingRow.id} row={editingRow} updateAction={updateAction} onCancel={() => setEditingId(null)} />}
      <DataTable
        columns={columns}
        data={returns}
        getRowId={(row) => row.id}
        emptyTitle="Sonuç bulunamadı"
        emptyDescription="Arama veya filtre kriterlerine uygun iade talebi yok."
      />
    </>
  );
}
