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
import { ProductImagesField, type InitialProductImage } from "@/components/admin/product-images-field";
import { TagsField } from "@/components/admin/tags-field";
import { variantOptionsInclude } from "@/lib/variant-attributes";
import { deleteBlobUrls } from "@/lib/blob";
import { buildCategoryOptions } from "@/lib/category-tree";
import { GENDER_OPTIONS } from "@/lib/product-options";

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

type ImageWithAlt = { url: string; alt: string };

function parseImagesWithAlt(raw: unknown): ImageWithAlt[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((v): v is Record<string, unknown> => typeof v === "object" && v !== null)
    .map((v) => ({
      url: typeof v.url === "string" ? v.url.trim() : "",
      alt: typeof v.alt === "string" ? v.alt.trim() : ""
    }))
    .filter((v) => v.url);
}

function parseProductImagesJson(raw: string): ImageWithAlt[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  return parseImagesWithAlt(parsed);
}

function parseColorImagesJson(raw: string): { valueId: string; images: ImageWithAlt[] }[] {
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
      valueId: typeof v.valueId === "string" ? v.valueId : "",
      images: parseImagesWithAlt(v.images)
    }))
    .filter((v) => v.valueId && v.images.length > 0);
}

function parseTagIdsJson(raw: string): string[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.filter((v): v is string => typeof v === "string" && v.length > 0);
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
  const brandId = String(formData.get("brandId") || "") || null;
  const material = String(formData.get("material") || "").trim() || null;
  const origin = String(formData.get("origin") || "").trim() || null;
  const careInstructions = String(formData.get("careInstructions") || "").trim() || null;
  const gender = String(formData.get("gender") || "").trim() || null;
  const isFeatured = formData.get("isFeatured") === "on";
  const tagIds = parseTagIdsJson(String(formData.get("tagIds") || "[]"));
  const images = parseProductImagesJson(String(formData.get("images") || "[]"));
  const variants = parseVariantsJson(String(formData.get("variantsJson") || "[]"));
  const colorImages = parseColorImagesJson(String(formData.get("colorImagesJson") || "[]"));

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

  const existing = await prisma.product.findUnique({
    where: { id },
    select: {
      images: { select: { url: true } },
      optionImages: { select: { url: true } }
    }
  });
  const oldUrls = [
    ...(existing?.images.map((i) => i.url) ?? []),
    ...(existing?.optionImages.map((i) => i.url) ?? [])
  ];

  try {
    await prisma.$transaction(async (tx) => {
      await tx.product.update({
        where: { id },
        data: {
          name,
          slug,
          description,
          priceCents,
          compareAtCents,
          categoryId,
          status,
          brandId,
          material,
          origin,
          careInstructions,
          gender,
          isFeatured,
          tags: { set: tagIds.map((tagId) => ({ id: tagId })) }
        }
      });
      await tx.productImage.deleteMany({ where: { productId: id } });
      await tx.productImage.createMany({
        data: images.map((img, i) => ({ productId: id, url: img.url, alt: img.alt, position: i }))
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
      await tx.productOptionImage.deleteMany({ where: { productId: id } });
      for (const c of colorImages) {
        await tx.productOptionImage.createMany({
          data: c.images.map((img, i) => ({
            productId: id,
            valueId: c.valueId,
            url: img.url,
            alt: img.alt,
            position: i
          }))
        });
      }
    });
  } catch {
    redirect(`/admin/urunler/${id}?hata=kaydedilemedi`);
  }

  const newUrls = new Set([
    ...images.map((i) => i.url),
    ...colorImages.flatMap((c) => c.images.map((i) => i.url))
  ]);
  const removedUrls = oldUrls.filter((url) => !newUrls.has(url));
  await deleteBlobUrls(removedUrls);

  redirect(`/admin/urunler/${id}?basarili=guncellendi`);
}

async function deleteProduct(id: string) {
  "use server";
  const existing = await prisma.product.findUnique({
    where: { id },
    select: {
      images: { select: { url: true } },
      optionImages: { select: { url: true } }
    }
  });
  const urls = [
    ...(existing?.images.map((i) => i.url) ?? []),
    ...(existing?.optionImages.map((i) => i.url) ?? [])
  ];
  try {
    await prisma.product.delete({ where: { id } });
  } catch {
    redirect(`/admin/urunler/${id}?hata=silinemedi`);
  }
  await deleteBlobUrls(urls);
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
  const [product, categories, attributes, brands, tags] = await Promise.all([
    prisma.product.findUnique({
      where: { id },
      include: {
        variants: { include: variantOptionsInclude },
        images: { orderBy: { position: "asc" } },
        optionImages: { orderBy: { position: "asc" } },
        tags: { select: { id: true } }
      }
    }),
    prisma.category.findMany({ orderBy: { name: "asc" } }),
    prisma.variantAttribute.findMany({
      orderBy: { position: "asc" },
      include: { values: { orderBy: { position: "asc" } } }
    }),
    prisma.brand.findMany({ orderBy: { name: "asc" } }),
    prisma.tag.findMany({ orderBy: { name: "asc" } })
  ]);
  if (!product) notFound();
  const attributeOptions: AttributeOption[] = attributes;
  const categoryOptions = buildCategoryOptions(categories);

  const updateWithId = updateProduct.bind(null, product.id);
  const deleteWithId = deleteProduct.bind(null, product.id);
  const initialImages: InitialProductImage[] = product.images.map((i) => ({ url: i.url, alt: i.alt }));
  const initialColorImages: Record<string, { url: string; alt: string }[]> = {};
  for (const img of product.optionImages) {
    (initialColorImages[img.valueId] ??= []).push({ url: img.url, alt: img.alt });
  }
  const initialTagIds = product.tags.map((t) => t.id);
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
            colorImagesFieldName="colorImagesJson"
            initialRows={variantRows}
            initialColorImages={initialColorImages}
            attributes={attributeOptions}
            defaultPriceLabel={defaultPriceLabel}
            defaultCompareAtLabel={defaultCompareAtLabel}
          />
        </Card>

        <Card title="Görseller">
          <ProductImagesField name="images" initialImages={initialImages} />
        </Card>

        <Card title="Ürün Detayları">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Materyal</label>
                <input
                  name="material"
                  defaultValue={product.material ?? ""}
                  placeholder="örn. %95 Pamuk, %5 Elastan"
                  className={`mt-1 ${inputClass}`}
                />
              </div>
              <div>
                <label className={labelClass}>Menşei</label>
                <input
                  name="origin"
                  defaultValue={product.origin ?? ""}
                  placeholder="örn. Türkiye'de üretilmiştir"
                  className={`mt-1 ${inputClass}`}
                />
              </div>
            </div>
            <div>
              <label className={labelClass}>Bakım Talimatı</label>
              <textarea
                name="careInstructions"
                defaultValue={product.careInstructions ?? ""}
                rows={2}
                placeholder="örn. 30°C'de yıkayın, ütülemeyin"
                className={`mt-1 ${inputClass}`}
              />
            </div>
            <div>
              <label className={labelClass}>Cinsiyet</label>
              <select name="gender" defaultValue={product.gender ?? ""} className={`mt-1 ${inputClass}`}>
                <option value="">Belirtilmedi</option>
                {GENDER_OPTIONS.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Etiketler</label>
              <div className="mt-1">
                <TagsField fieldName="tagIds" allTags={tags} initialSelectedIds={initialTagIds} />
              </div>
            </div>
          </div>
        </Card>

        <Card title="Kategori ve Durum">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Kategori</label>
              <select name="categoryId" defaultValue={product.categoryId ?? ""} className={`mt-1 ${inputClass}`}>
                <option value="">Kategori yok</option>
                {categoryOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Marka</label>
              <select name="brandId" defaultValue={product.brandId ?? ""} className={`mt-1 ${inputClass}`}>
                <option value="">Marka yok</option>
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
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
            <div className="flex items-end pb-2.5">
              <label className="flex items-center gap-2 text-sm text-admin-text">
                <input
                  type="checkbox"
                  name="isFeatured"
                  defaultChecked={product.isFeatured}
                  className="h-4 w-4 rounded border-admin-border text-admin-accent focus:ring-admin-accent"
                />
                Öne Çıkan Ürün
              </label>
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
