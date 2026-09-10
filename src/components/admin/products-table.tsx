"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ImageOff, Check, RefreshCw, Loader2, Link2, Pencil, Tag, ExternalLink, X } from "lucide-react";
import { DataTable, type DataTableColumn } from "@/components/admin/data-table";
import { Badge, type BadgeTone } from "@/components/admin/badge";
import type { BulkAction } from "@/components/admin/bulk-action-bar";
import { useToast } from "@/components/admin/toast";
import { IconButton, IconLinkButton } from "@/components/admin/icon-button";
import { formatPrice } from "@/lib/format";

export interface ProductRow {
  id: string;
  name: string;
  code: string | null;
  slug: string;
  status: string;
  priceCents: number;
  stock: number;
  createdAt: string;
  imageUrl: string | null;
  // Urunun varyantlarinda gercekten var olan renkler (Renk ekseni,
  // isColor:true) - bos ise renk varyasyonu yok.
  colors: string[];
}

const statusLabel: Record<string, string> = { DRAFT: "Taslak", PUBLISHED: "Yayında", ARCHIVED: "Arşiv" };
const statusTone: Record<string, BadgeTone> = { DRAFT: "gray", PUBLISHED: "green", ARCHIVED: "gray-muted" };

async function bulkRequest(body: Record<string, unknown>) {
  const res = await fetch("/api/admin/urunler/bulk", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, error: data?.error as string | undefined };
}

export function ProductsTable({
  products,
  initialSort
}: {
  products: ProductRow[];
  initialSort?: { key: string; direction: "asc" | "desc" } | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { showToast } = useToast();
  const [refreshingIds, setRefreshingIds] = useState<Set<string>>(new Set());
  const [addingImageIds, setAddingImageIds] = useState<Set<string>>(new Set());
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
  const [priceDraft, setPriceDraft] = useState("");
  const [priceError, setPriceError] = useState<string | null>(null);
  const [savingPrice, setSavingPrice] = useState(false);

  function handleFiyatDuzenleAc(row: ProductRow) {
    setEditingPriceId(row.id);
    setPriceDraft((row.priceCents / 100).toFixed(2));
    setPriceError(null);
  }

  function handleFiyatVazgec() {
    setEditingPriceId(null);
    setPriceError(null);
  }

  async function handleFiyatKaydet(id: string) {
    const deger = parseFloat(priceDraft.replace(",", "."));
    if (!Number.isFinite(deger) || deger <= 0) {
      setPriceError("Geçerli bir fiyat girin");
      return;
    }
    const priceCents = Math.round(deger * 100);
    setSavingPrice(true);
    try {
      const { ok, error } = await bulkRequest({ ids: [id], action: "SET_PRICE", priceCents });
      if (ok) {
        setEditingPriceId(null);
        setPriceError(null);
        showToast("Fiyat güncellendi.", "success");
        router.refresh();
      } else {
        showToast(error ?? "Bir hata oluştu.", "error");
      }
    } finally {
      setSavingPrice(false);
    }
  }

  async function handleGorselEkle(id: string) {
    const url = window.prompt(
      "Koton ürün sayfasının linkini yapıştırın (koton.com'da ürünü bulup adres çubuğundaki linki kopyalayın). Görseller otomatik olarak eklenecek:"
    );
    if (!url || !url.trim()) return;

    setAddingImageIds((prev) => new Set(prev).add(id));
    try {
      const res = await fetch(`/api/admin/urunler/${id}/gorsel-ekle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(data.error ?? "Görsel eklenemedi.", "error");
        return;
      }
      if (data.found && data.imagesAdded > 0) {
        showToast(`${data.imagesAdded} görsel eklendi.`, "success");
        router.refresh();
      } else if (data.found) {
        showToast("Sayfa bulundu ama bu renkler için görsel bulunamadı.", "error");
      } else {
        showToast("Bu linkten ürün verisi alınamadı (kod eşleşmedi ya da sayfa açılamadı).", "error");
      }
    } catch {
      showToast("Görsel eklenirken bir hata oluştu.", "error");
    } finally {
      setAddingImageIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

  async function handleGorselYenile(id: string) {
    setRefreshingIds((prev) => new Set(prev).add(id));
    try {
      const res = await fetch(`/api/admin/urunler/${id}/gorsel-yenile`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(data.error ?? "Görsel arama başarısız oldu.", "error");
        return;
      }
      if (data.found && data.imagesAdded > 0) {
        showToast(`${data.imagesAdded} görsel eklendi.`, "success");
        router.refresh();
      } else if (data.found) {
        showToast("Ürün Koton'da bulundu ama bu renkler için görsel bulunamadı.", "error");
      } else {
        showToast("Koton'da bulunamadı.", "error");
      }
    } catch {
      showToast("Görsel arama sırasında bir hata oluştu.", "error");
    } finally {
      setRefreshingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

  function handleSortChange(key: string, direction: "asc" | "desc") {
    const params = new URLSearchParams(searchParams.toString());
    params.set("sort", key);
    params.set("dir", direction);
    router.push(`${pathname}?${params.toString()}`);
  }

  async function handleStatusChange(ids: string[], status: string, clearSelection: () => void) {
    const { ok, error } = await bulkRequest({ ids, action: "SET_STATUS", status });
    if (ok) {
      showToast("Ürün durumu güncellendi.", "success");
      clearSelection();
      router.refresh();
    } else {
      showToast(error ?? "Bir hata oluştu.", "error");
    }
  }

  async function handleDelete(ids: string[], clearSelection: () => void) {
    if (!window.confirm(`${ids.length} ürünü silmek istediğinize emin misiniz?`)) return;
    const { ok, error } = await bulkRequest({ ids, action: "DELETE" });
    if (ok) {
      showToast("Ürünler silindi.", "success");
      clearSelection();
      router.refresh();
    } else {
      showToast(error ?? "Bir hata oluştu.", "error");
    }
  }

  const columns: DataTableColumn<ProductRow>[] = [
    {
      key: "name",
      header: "Ürün",
      sortable: true,
      render: (row) => (
        <Link href={`/admin/urunler/${row.id}`} className="flex items-center gap-3 hover:underline">
          <span
            className={`flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-md border ${
              row.imageUrl ? "border-admin-border bg-admin-bg" : "border-red-300 bg-red-50"
            }`}
          >
            {row.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={row.imageUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <ImageOff size={14} className="text-red-400" />
            )}
          </span>
          <span className="flex flex-col">
            <span className="font-medium text-admin-text">{row.name}</span>
            {!row.imageUrl && (
              <span className="mt-0.5">
                <Badge tone="red">Fotoğraf Yok</Badge>
              </span>
            )}
          </span>
        </Link>
      )
    },
    {
      key: "code",
      header: "Ürün Kodu",
      sortable: false,
      hideOnMobile: true,
      render: (row) => <span className="text-sm text-admin-text-muted">{row.code || "—"}</span>
    },
    {
      key: "photo",
      header: "Fotoğraf",
      sortable: true,
      align: "center",
      render: (row) =>
        row.imageUrl ? (
          <Check size={16} className="mx-auto text-admin-text-muted" />
        ) : (
          <ImageOff size={16} className="mx-auto text-red-400" />
        )
    },
    {
      key: "status",
      header: "Durum",
      render: (row) => <Badge tone={statusTone[row.status]}>{statusLabel[row.status] ?? row.status}</Badge>
    },
    {
      key: "colors",
      header: "Renkler",
      render: (row) =>
        row.colors.length > 1 ? (
          <span title={row.colors.join(", ")}>
            <Badge tone="blue">{row.colors.length} Renk</Badge>
          </span>
        ) : row.colors.length === 1 ? (
          <span className="text-sm text-admin-text-muted">{row.colors[0]}</span>
        ) : (
          <span className="text-admin-text-muted">—</span>
        )
    },
    {
      key: "price",
      header: "Fiyat",
      sortable: true,
      align: "right",
      render: (row) =>
        row.id === editingPriceId ? (
          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-1">
              <input
                type="text"
                inputMode="decimal"
                autoFocus
                disabled={savingPrice}
                value={priceDraft}
                onChange={(e) => setPriceDraft(e.target.value)}
                onFocus={(e) => e.target.select()}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleFiyatKaydet(row.id);
                  if (e.key === "Escape") handleFiyatVazgec();
                }}
                className={`h-8 w-20 rounded border px-1.5 py-1 text-right text-sm disabled:opacity-50 ${
                  priceError ? "border-red-400" : "border-admin-border"
                }`}
              />
              <IconButton
                title="Kaydet"
                disabled={savingPrice}
                onClick={() => handleFiyatKaydet(row.id)}
                className="text-green-600 hover:bg-green-50 hover:text-green-700"
              >
                {savingPrice ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              </IconButton>
              <IconButton title="Vazgeç" disabled={savingPrice} onClick={handleFiyatVazgec}>
                <X size={14} />
              </IconButton>
            </div>
            {priceError && <span className="text-xs text-red-600">{priceError}</span>}
          </div>
        ) : (
          formatPrice(row.priceCents)
        )
    },
    {
      key: "stock",
      header: "Stok",
      sortable: true,
      align: "right",
      render: (row) => row.stock
    },
    {
      key: "createdAt",
      header: "Oluşturulma",
      sortable: true,
      hideOnMobile: true,
      render: (row) => new Date(row.createdAt).toLocaleDateString("tr-TR")
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (row) => (
        <div className="flex items-center justify-end gap-1.5">
          <IconLinkButton href={`/admin/urunler/${row.id}`} title="Düzenle" className="h-9 w-9 md:h-8 md:w-8">
            <Pencil size={15} />
          </IconLinkButton>
          <IconButton
            title="Fiyat Güncelle"
            aria-label="Fiyat Güncelle"
            onClick={() => handleFiyatDuzenleAc(row)}
            className={`h-9 w-9 md:h-8 md:w-8 ${row.id === editingPriceId ? "bg-admin-accent/10 text-admin-accent" : ""}`}
          >
            <Tag size={15} />
          </IconButton>
          {!row.imageUrl && (
            <IconButton
              title="Fotoğrafları Yeniden Ara"
              onClick={() => handleGorselYenile(row.id)}
              disabled={refreshingIds.has(row.id)}
              className="h-9 w-9 md:h-8 md:w-8"
            >
              {refreshingIds.has(row.id) ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <RefreshCw size={15} />
              )}
            </IconButton>
          )}
          {!row.imageUrl && (
            <IconButton
              title="Koton Linkiyle Ekle"
              onClick={() => handleGorselEkle(row.id)}
              disabled={addingImageIds.has(row.id)}
              className="h-9 w-9 md:h-8 md:w-8"
            >
              {addingImageIds.has(row.id) ? <Loader2 size={15} className="animate-spin" /> : <Link2 size={15} />}
            </IconButton>
          )}
          <IconLinkButton
            href={`/urunler/${row.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            title={row.status !== "PUBLISHED" ? "Ürün yayında değil, sitede görünmez" : "Ürünü Gör"}
            disabled={row.status !== "PUBLISHED"}
            className="h-9 w-9 md:h-8 md:w-8"
          >
            <ExternalLink size={15} />
          </IconLinkButton>
        </div>
      )
    }
  ];

  function bulkActions(selectedIds: string[], clearSelection: () => void): BulkAction[] {
    return [
      { label: "Yayına Al", variant: "secondary", onClick: () => handleStatusChange(selectedIds, "PUBLISHED", clearSelection) },
      { label: "Taslağa Al", variant: "secondary", onClick: () => handleStatusChange(selectedIds, "DRAFT", clearSelection) },
      { label: "Arşivle", variant: "secondary", onClick: () => handleStatusChange(selectedIds, "ARCHIVED", clearSelection) },
      { label: "Sil", variant: "danger", onClick: () => handleDelete(selectedIds, clearSelection) }
    ];
  }

  return (
    <DataTable
      columns={columns}
      data={products}
      getRowId={(row) => row.id}
      selectable
      bulkActions={bulkActions}
      onSortChange={handleSortChange}
      initialSort={initialSort}
      emptyTitle="Sonuç bulunamadı"
      emptyDescription="Arama veya filtre kriterlerine uygun ürün yok."
    />
  );
}
