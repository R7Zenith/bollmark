"use client";

import { useState } from "react";
import Link from "next/link";
import { Upload, ArrowLeft, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/admin/button";
import { Card } from "@/components/admin/card";
import { formatPrice } from "@/lib/format";
import { useToast } from "@/components/admin/toast";

type CategoryOption = { id: string; label: string };

type ExcelImportRow = {
  rowNumber: number;
  productCode: string;
  productName: string;
  barcode: string;
  genderRaw: string;
  color: string;
  size: string;
  costCents: number | null;
  priceCents: number;
  stock: number;
  brandName: string;
};

type ParseError = { row: number; message: string };

type PreviewGroup = {
  productCode: string;
  productName: string;
  gender: string | null;
  brandName: string;
  priceCents: number;
  costCents: number | null;
  colors: string[];
  variantCount: number;
  totalStock: number;
};

type PreviewResponse = {
  rows: ExcelImportRow[];
  errors: ParseError[];
  groups: PreviewGroup[];
  totalVariants: number;
  totalStock: number;
};

type KotonResult = {
  productId: string;
  productCode: string;
  found: boolean;
  imagesAdded: number;
  descriptionUpdated: boolean;
};

type ImportResponse = {
  productsCreated: number;
  productsUpdated: number;
  variantsCreated: number;
  variantsUpdated: number;
  kotonResults: KotonResult[];
};

type Step = "upload" | "preview" | "result";

export function ExcelImportWizard({ categories }: { categories: CategoryOption[] }) {
  const { showToast } = useToast();
  const [step, setStep] = useState<Step>("upload");
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [categoryId, setCategoryId] = useState("");
  const [result, setResult] = useState<ImportResponse | null>(null);
  const [productNameByCode, setProductNameByCode] = useState<Record<string, string>>({});

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/admin/urunler/excel-yukle", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error ?? "Dosya işlenemedi.", "error");
        return;
      }
      const preview = data as PreviewResponse;
      setPreview(preview);
      setProductNameByCode(Object.fromEntries(preview.groups.map((g) => [g.productCode, g.productName])));
      setStep("preview");
    } catch {
      showToast("Dosya yüklenirken bir hata oluştu.", "error");
    } finally {
      setLoading(false);
    }
  }

  async function handleImport() {
    if (!preview) return;
    setLoading(true);
    try {
      const res = await fetch("/api/admin/urunler/excel-aktar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: preview.rows, categoryId: categoryId || null })
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error ?? "İçe aktarım başarısız oldu.", "error");
        return;
      }
      setResult(data as ImportResponse);
      setStep("result");
    } catch {
      showToast("İçe aktarım sırasında bir hata oluştu.", "error");
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setStep("upload");
    setPreview(null);
    setResult(null);
    setCategoryId("");
  }

  if (step === "upload") {
    return (
      <Card title="1. Excel Dosyası Seç">
        <div className="space-y-4">
          <p className="text-sm text-admin-text-muted">
            Dükkanın checklist sistemi tarafından üretilen .xls veya .xlsx dosyasını seçin. Aynı ÜRÜN KODU'na
            sahip satırlar tek bir ürün altında renk/beden varyantı olarak gruplanır.
          </p>
          <label className="flex w-fit cursor-pointer items-center gap-2 rounded-md bg-admin-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700">
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
            {loading ? "Yükleniyor..." : "Dosya Seç"}
            <input type="file" accept=".xls,.xlsx" className="hidden" onChange={handleFileChange} disabled={loading} />
          </label>
        </div>
      </Card>
    );
  }

  if (step === "preview" && preview) {
    return (
      <div className="space-y-6">
        <Card
          title="2. Önizleme"
          action={
            <button onClick={reset} className="inline-flex items-center gap-1 text-xs text-admin-text-muted hover:text-admin-text">
              <ArrowLeft size={14} /> Başka dosya seç
            </button>
          }
        >
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-xs text-admin-text-muted">Ürün sayısı</p>
                <p className="text-lg font-semibold text-admin-text">{preview.groups.length}</p>
              </div>
              <div>
                <p className="text-xs text-admin-text-muted">Varyant sayısı</p>
                <p className="text-lg font-semibold text-admin-text">{preview.totalVariants}</p>
              </div>
              <div>
                <p className="text-xs text-admin-text-muted">Toplam stok</p>
                <p className="text-lg font-semibold text-admin-text">{preview.totalStock}</p>
              </div>
            </div>

            {preview.errors.length > 0 && (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                <p className="mb-1 flex items-center gap-1.5 font-medium">
                  <AlertTriangle size={14} /> {preview.errors.length} satır atlandı
                </p>
                <ul className="ml-5 list-disc space-y-0.5">
                  {preview.errors.slice(0, 20).map((err, i) => (
                    <li key={i}>
                      Satır {err.row}: {err.message}
                    </li>
                  ))}
                </ul>
                {preview.errors.length > 20 && <p className="mt-1">...ve {preview.errors.length - 20} tane daha.</p>}
              </div>
            )}

            <div>
              <label className="text-xs font-medium uppercase tracking-wide text-admin-text-muted">
                Kategori (tüm ürünlere uygulanır, opsiyonel)
              </label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="mt-1 w-full max-w-sm rounded-md border border-admin-border px-4 py-2.5 text-sm focus:border-admin-accent focus:outline-none focus:ring-1 focus:ring-admin-accent"
              >
                <option value="">Kategori seç (opsiyonel)</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="overflow-x-auto rounded-lg border border-admin-border">
              <table className="w-full min-w-max border-collapse text-sm">
                <thead>
                  <tr className="border-b border-admin-border text-left text-xs uppercase tracking-wide text-admin-text-muted">
                    <th className="px-4 py-3">Ürün Kodu</th>
                    <th className="px-4 py-3">Ürün Adı</th>
                    <th className="px-4 py-3">Cinsiyet</th>
                    <th className="px-4 py-3">Renkler</th>
                    <th className="px-4 py-3 text-right">Varyant</th>
                    <th className="px-4 py-3 text-right">Stok</th>
                    <th className="px-4 py-3 text-right">Fiyat</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.groups.map((g) => (
                    <tr key={g.productCode} className="border-b border-admin-border last:border-0">
                      <td className="px-4 py-3 font-mono text-xs text-admin-text">{g.productCode}</td>
                      <td className="px-4 py-3 text-admin-text">{g.productName}</td>
                      <td className="px-4 py-3 text-admin-text-muted">{g.gender ?? "—"}</td>
                      <td className="px-4 py-3 text-admin-text-muted">{g.colors.join(", ")}</td>
                      <td className="px-4 py-3 text-right text-admin-text">{g.variantCount}</td>
                      <td className="px-4 py-3 text-right text-admin-text">{g.totalStock}</td>
                      <td className="px-4 py-3 text-right text-admin-text">{formatPrice(g.priceCents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Button onClick={handleImport} disabled={loading || preview.groups.length === 0}>
              {loading ? <Loader2 size={16} className="animate-spin" /> : null}
              {loading ? "İçe aktarılıyor..." : "İçe Aktar"}
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  if (step === "result" && result) {
    return (
      <Card title="3. Sonuç">
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
            <div>
              <p className="text-xs text-admin-text-muted">Yeni ürün</p>
              <p className="text-lg font-semibold text-admin-text">{result.productsCreated}</p>
            </div>
            <div>
              <p className="text-xs text-admin-text-muted">Güncellenen ürün</p>
              <p className="text-lg font-semibold text-admin-text">{result.productsUpdated}</p>
            </div>
            <div>
              <p className="text-xs text-admin-text-muted">Yeni varyant</p>
              <p className="text-lg font-semibold text-admin-text">{result.variantsCreated}</p>
            </div>
            <div>
              <p className="text-xs text-admin-text-muted">Güncellenen varyant</p>
              <p className="text-lg font-semibold text-admin-text">{result.variantsUpdated}</p>
            </div>
          </div>

          {result.kotonResults.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-admin-text-muted">
                Koton görsel eşleştirme (yeni ürünler)
              </p>
              <ul className="space-y-1.5 text-sm">
                {result.kotonResults.map((r) => (
                  <li key={r.productId} className="flex items-center gap-2">
                    {r.found ? (
                      <CheckCircle2 size={15} className="shrink-0 text-green-600" />
                    ) : (
                      <AlertTriangle size={15} className="shrink-0 text-amber-500" />
                    )}
                    <span className="font-mono text-xs text-admin-text-muted">{r.productCode}</span>
                    <span className="text-admin-text">{productNameByCode[r.productCode] ?? ""}</span>
                    <span className="text-admin-text-muted">
                      {r.found
                        ? `— ${r.imagesAdded} görsel eklendi${r.descriptionUpdated ? ", açıklama güncellendi" : ""}`
                        : "— Koton'da bulunamadı, görseller elle eklenmeli"}
                    </span>
                    <Link href={`/admin/urunler/${r.productId}`} className="ml-auto text-admin-accent hover:underline">
                      Ürünü aç
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex gap-3">
            <Button variant="secondary" onClick={reset}>
              Başka dosya yükle
            </Button>
            <Link href="/admin/urunler">
              <Button>Ürünler listesine dön</Button>
            </Link>
          </div>
        </div>
      </Card>
    );
  }

  return null;
}
