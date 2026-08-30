import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/admin/card";
import { SaveBar } from "@/components/admin/save-bar";
import { ProductFeedback } from "@/components/admin/product-feedback";
import { DeleteProductForm } from "@/components/admin/delete-product-form";
import {
  VariantEditor,
  type AttributeOption,
  type VariantRow,
  type SerializedVariant
} from "@/components/admin/variant-editor";
import { ProductImagesField } from "@/components/admin/product-images-field";
import { variantOptionsInclude } from "@/lib/variant-attributes";

function parseVariantsJson(raw: string): SerializedVariant[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed
    .filter((v): v is Record<string, unknown> => typeof v === "object" && v !== null)
    .map((v) => ({
      id: typeof v.id === "string" ? v.id : undefined,
      optionValueIds: Array.isArray(v.optionValueIds)
        ? v.optionValueIds.filter((id): id is string => typeof id === "string" && id.length > 0)
        : [],
      sku: String(v.sku ?? "").trim(),
      barcode: typeof v.barcode === "string" && v.barcode.trim() ? v.barcode.trim() : null,
      stock: Math.max(0, Math.round(Number(v.stock) || 0)),
      priceCents:
        typeof v.priceCents === "number" && Number.isFinite(v.priceCents) && v.priceCents > 0
          ? Math.round(v.priceCents)
          : null,
      compareAtCents:
        typeof v.compareAtCents === "number" && Number.isFinite(v.compareAtCents) && v.compareAtCents > 0
          ? Math.round(v.compareAtCents)
          : null
    }));
}

const inputClass =
  "w-full rounded-md border border-admin-border px-4 py-2.5 text-sm focus:border-admin-accent focus:outline-none focus:ring-1 focus:ring-admin-accent";
const labelClass = "text-xs font-medium uppercase tracking-wide text-admin-text-muted";

async function updateProduct(id: string, formData: FormData) {
  "use server";
  const name = String(formData.get("name") || "").trim();
  const slug = String(formData.get("slug") || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-");
  const description = String(formData.get("description") || "");
  const priceCents = Math.round(Number(formData.get("price") || 0) * 100);
  const compareAtRaw = String(formData.get("compareAt") || "").trim();
  const compareAtCents = compareAtRaw ? Math.round(Number(compareAtRaw) * 100) : null;
  const categoryId = String(formData.get("categoryId") || "") || null;
  const status = String(formData.get("status") || "DRAFT") as "DRAFT" | "PUBLISHED" | "ARCHIVED";
  const imageUrls = String(formData.get("images") || "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  const variants = parseVariantsJson(String(formData.get("variantsJson") || "[]"));

  const skuSet = new Set<string>();
  for (const v of variants) {
    const sku = v.sku || `${slug}-${Math.random().toString(36).slice(2, 8)}`;
    if (skuSet.has(sku)) {
      redirect(`/admin/urunler/${id}?hata=sku-tekrar`);
    }
    skuSet.add(sku);
  }
  const comboSet = new Set<string>();
  for (const v of variants) {
    const key = [...v.optionValueIds].sort().join("::");
    if (comboSet.has(key)) {
      redirect(`/admin/urunler/${id}?hata=varyant-tekrar`);
    }
    comboSet.add(key);
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.product.update({
        where: { id },
        data: { name, slug, description, priceCents, compareAtCents, categoryId, status }
      });
      await tx.productImage.deleteMany({ where: { productId: id } });
      await tx.productImage.createMany({
        data: imageUrls.map((url, i) => ({ productId: id, url, position: i }))
      });
      await tx.productVariant.deleteMany({ where: { productId: id } });
      for (const v of variants) {
        await tx.productVariant.create({
          data: {
            productId: id,
            sku: v.sku || `${slug}-${Math.random().toString(36).slice(2, 8)}`,
            barcode: v.barcode,
            stock: v.stock,
            priceCents: v.priceCents,
            compareAtCents: v.compareAtCents,
            options: { create: v.optionValueIds.map((valueId) => ({ valueId })) }
          }
        });
      }
    });
  } catch {
    redirect(`/admin/urunler/${id}?hata=kaydedilemedi`);
  }

  redirect(`/admin/urunler/${id}?basarili=guncellendi`);
}

async function deleteProduct(id: string) {
  "use server";
  try {
    await prisma.product.delete({ where: { id } });
  } catch {
    redirect(`/admin/urunler/${id}?hata=silinemedi`);
  }
  redirect("/admin/urunler");
}

export default async function EditProductPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ basarili?: string; hata?: string }>;
}) {
  const { id } = await params;
  const { basarili, hata } = await searchParams;
  const [product, categories, attributes] = await Promise.all([
    prisma.product.findUnique({
      where: { id },
      include: {
        variants: { include: variantOptionsInclude },
        images: { orderBy: { position: "asc" } }
      }
    }),
    prisma.category.findMany({ orderBy: { name: "asc" } }),
    prisma.variantAttribute.findMany({
      orderBy: { position: "asc" },
      include: { values: { orderBy: { position: "asc" } } }
    })
  ]);
  if (!product) notFound();
  const attributeOptions: AttributeOption[] = attributes;

  const updateWithId = updateProduct.bind(null, product.id);
  const deleteWithId = deleteProduct.bind(null, product.id);
  const initialImages = product.images.map((i) => i.url);
  const variantRows: VariantRow[] = product.variants.map((v) => ({
    clientId: v.id,
    id: v.id,
    optionValueIds: v.options.map((o) => o.valueId),
    sku: v.sku,
    barcode: v.barcode ?? "",
    stock: String(v.stock),
    price: v.priceCents !== null ? (v.priceCents / 100).toFixed(2) : "",
    compareAt: v.compareAtCents !== null ? (v.compareAtCents / 100).toFixed(2) : ""
  }));
  const defaultPriceLabel = `${(product.priceCents / 100).toFixed(2)} TL`;
  const defaultCompareAtLabel = product.compareAtCents
    ? `Varsayılan: ${(product.compareAtCents / 100).toFixed(2)} TL`
    : "Boş = indirim gösterilmez";

  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-semibold text-admin-text">Ürünü Düzenle</h1>

      <ProductFeedback basarili={basarili} hata={hata} />

      <form id="product-form" action={updateWithId} className="mt-8 space-y-6">
        <Card title="Temel Bilgiler">
          <div className="space-y-4">
            <div>
              <label className={labelClass}>Ürün Adı</label>
              <input name="name" defaultValue={product.name} required className={`mt-1 ${inputClass}`} />
            </div>
            <div>
              <label className={labelClass}>URL Uzantısı (slug)</label>
              <input name="slug" defaultValue={product.slug} required className={`mt-1 ${inputClass}`} />
            </div>
            <div>
              <label className={labelClass}>Açıklama</label>
              <textarea name="description" defaultValue={product.description} rows={4} className={`mt-1 ${inputClass}`} />
            </div>
          </div>
        </Card>

        <Card title="Fiyatlandırma">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Fiyat (TL)</label>
              <input
                name="price"
                type="number"
                step="0.01"
                defaultValue={(product.priceCents / 100).toFixed(2)}
                className={`mt-1 ${inputClass}`}
              />
            </div>
            <div>
              <label className={labelClass}>İndirim Öncesi Fiyat (TL, opsiyonel)</label>
              <input
                name="compareAt"
                type="number"
                step="0.01"
                defaultValue={product.compareAtCents ? (product.compareAtCents / 100).toFixed(2) : ""}
                className={`mt-1 ${inputClass}`}
              />
            </div>
          </div>
        </Card>

        <Card title="Varyantlar">
          <VariantEditor
            fieldName="variantsJson"
            initialRows={variantRows}
            attributes={attributeOptions}
            defaultPriceLabel={defaultPriceLabel}
            defaultCompareAtLabel={defaultCompareAtLabel}
          />
        </Card>

        <Card title="Görseller">
          <ProductImagesField name="images" initialImages={initialImages} />
        </Card>

        <Card title="Kategori ve Durum">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Kategori</label>
              <select name="categoryId" defaultValue={product.categoryId ?? ""} className={`mt-1 ${inputClass}`}>
                <option value="">Kategori yok</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Durum</label>
              <select name="status" defaultValue={product.status} className={`mt-1 ${inputClass}`}>
                <option value="DRAFT">Taslak</option>
                <option value="PUBLISHED">Yayında</option>
                <option value="ARCHIVED">Arşiv</option>
              </select>
            </div>
          </div>
        </Card>

        <SaveBar formId="product-form" />
      </form>

      <div className="mt-8 border-t border-admin-border pt-6">
        <DeleteProductForm action={deleteWithId} />
      </div>
    </div>
  );
}
