"use client";

import { useState } from "react";
import Link from "next/link";
import { Upload, ArrowLeft, CheckCircle2, AlertTriangle, HelpCircle, Loader2 } from "lucide-react";
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
  categoryRaw: string;
  color: string;
  size: string;
  costCents: number | null;
  priceCents: number;
  stock: number;
  brandName: string;
};

type ParseError = { row: number; message: string };

type CategorySuggestion = { categoryName: string; confidence: "high" | "medium" | "low"; reason: string };

type PreviewGroup = {
  productCode: string;
  productName: string;
  gender: string | null;
  categoryRaw: string | null;
  detectedCategory: string | null;
  suggestedCategory: CategorySuggestion | null;
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

export function ExcelImportWizard({
  categories,
  categoryNames
}: {
  categories: CategoryOption[];
  categoryNames: string[];
}) {
  const { showToast } = useToast();
  const [step, setStep] = useState<Step>("upload");
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [categoryId, setCategoryId] = useState("");
  const [categoryByCode, setCategoryByCode] = useState<Record<string, string>>({});
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
      setCategoryByCode(
        Object.fromEntries(
          preview.groups.map((g) => [g.productCode, g.detectedCategory ?? g.suggestedCategory?.categoryName ?? ""])
        )
      );
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
        body: JSON.stringify({ rows: preview.rows, categoryId: categoryId || null, categoryOverrides: categoryByCode })
      });
      const data = await res.json();
      if (!res.ok) {
        type UnresolvedCategory = { productCode: string; categoryName: string };
        const unresolved: UnresolvedCategory[] = Array.isArray(data.unresolvedCategories) ? data.unresolvedCategories : [];
        if (unresolved.length > 0) {
          const names = Array.from(new Set(unresolved.map((u) => u.categoryName))).slice(0, 5).join(", ");
          showToast(`${data.error ?? "Kategori adı bulunamadı."} (${names}${unresolved.length > 5 ? ", ..." : ""})`, "error");
        } else {
          showToast(data.error ?? "İçe aktarım başarısız oldu.", "error");
        }
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
    setCategoryByCode({});
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

            {(() => {
              const exactCount = preview.groups.filter((g) => g.detectedCategory).length;
              const suggestedCount = preview.groups.filter((g) => !g.detectedCategory && g.suggestedCategory).length;
              const noneCount = preview.groups.length - exactCount - suggestedCount;
              return (
                <div className="flex flex-wrap gap-4 rounded-md border border-admin-border bg-gray-50 p-3 text-xs">
                  <span className="inline-flex items-center gap-1.5 text-green-700">
                    <CheckCircle2 size={14} /> {exactCount} kesin eşleşti
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-amber-700">
                    <HelpCircle size={14} /> {suggestedCount} AI önerisi (kontrol bekliyor)
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-red-700">
                    <AlertTriangle size={14} /> {noneCount} eşleşmedi, elle girilmeli
                  </span>
                </div>
              );
            })()}

            <datalist id="excel-import-category-options">
              {categoryNames.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>

            <div>
              <label className="text-xs font-medium uppercase tracking-wide text-admin-text-muted">
                Eşleşmeyenler için kategori (opsiyonel)
              </label>
              <p className="mt-1 text-xs text-admin-text-muted">
                Yukarıda kategorisi otomatik tespit edilemeyen ürünler için kullanılır.
              </p>
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
                    <th className="px-4 py-3">Kategori</th>
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
                      <td className="px-4 py-3">
                        <div className="flex min-w-[11rem] flex-col gap-1">
                          {g.detectedCategory ? (
                            <span className="inline-flex w-fit items-center gap-1 rounded bg-green-50 px-1.5 py-0.5 text-xs text-green-700">
                              <CheckCircle2 size={12} /> Eşleşti
                            </span>
                          ) : g.suggestedCategory ? (
                            <span
                              className="inline-flex w-fit items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 text-xs text-amber-700"
                              title={g.suggestedCategory.reason}
                            >
                              <HelpCircle size={12} /> Öneri, kontrol et ({g.suggestedCategory.confidence})
                            </span>
                          ) : (
                            <span className="inline-flex w-fit items-center gap-1 rounded bg-red-50 px-1.5 py-0.5 text-xs text-red-700">
                              <AlertTriangle size={12} /> Eşleşmedi
                            </span>
                          )}
                          <input
                            type="text"
                            list="excel-import-category-options"
                            value={categoryByCode[g.productCode] ?? ""}
                            onChange={(e) =>
                              setCategoryByCode((prev) => ({ ...prev, [g.productCode]: e.target.value }))
                            }
                            placeholder="Kategori seç/yaz..."
                            className="w-full rounded-md border border-admin-border px-2 py-1.5 text-xs focus:border-admin-accent focus:outline-none focus:ring-1 focus:ring-admin-accent"
                          />
                        </div>
                      </td>
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
