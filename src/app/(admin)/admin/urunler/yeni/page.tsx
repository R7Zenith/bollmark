import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-admin";
import { Card } from "@/components/admin/card";
import { SaveBar } from "@/components/admin/save-bar";
import { ProductFeedback } from "@/components/admin/product-feedback";
import { VariantEditor, type AttributeOption, type SerializedVariant } from "@/components/admin/variant-editor";
import { ProductImagesField } from "@/components/admin/product-images-field";
import { TagsField } from "@/components/admin/tags-field";
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

async function createProduct(formData: FormData) {
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
    if (skuSet.has(sku)) redirect("/admin/urunler/yeni?hata=sku-tekrar");
    skuSet.add(sku);
  }
  const comboSet = new Set<string>();
  for (const v of variants) {
    const key = [...v.optionValueIds].sort().join("::");
    if (comboSet.has(key)) redirect("/admin/urunler/yeni?hata=varyant-tekrar");
    comboSet.add(key);
  }

  let product;
  try {
    product = await prisma.$transaction(async (tx) => {
      const created = await tx.product.create({
        data: {
          name,
          slug,
          description,
          priceCents,
          compareAtCents,
          status,
          categoryId,
          brandId,
          material,
          origin,
          careInstructions,
          gender,
          isFeatured,
          tags: { connect: tagIds.map((tagId) => ({ id: tagId })) },
          images: {
            create: images.map((img, i) => ({ url: img.url, alt: img.alt, position: i }))
          }
        }
      });
      for (const v of variants) {
        await tx.productVariant.create({
          data: {
            productId: created.id,
            sku: v.sku || `${slug}-${Math.random().toString(36).slice(2, 8)}`,
            barcode: v.barcode,
            stock: v.stock,
            priceCents: v.priceCents,
            compareAtCents: v.compareAtCents,
            options: { create: v.optionValueIds.map((valueId) => ({ valueId })) }
          }
        });
      }
      for (const c of colorImages) {
        await tx.productOptionImage.createMany({
          data: c.images.map((img, i) => ({
            productId: created.id,
            valueId: c.valueId,
            url: img.url,
            alt: img.alt,
            position: i
          }))
        });
      }
      return created;
    });
  } catch {
    redirect("/admin/urunler/yeni?hata=kaydedilemedi");
  }

  redirect(`/admin/urunler/${product.id}?basarili=olusturuldu`);
}

export default async function NewProductPage({
  searchParams
}: {
  searchParams: Promise<{ hata?: string }>;
}) {
  await requireAdmin();
  const { hata } = await searchParams;
  const [categories, attributes, brands, tags] = await Promise.all([
    prisma.category.findMany({ orderBy: { name: "asc" } }),
    prisma.variantAttribute.findMany({
      orderBy: { position: "asc" },
      include: { values: { orderBy: { position: "asc" } } }
    }),
    prisma.brand.findMany({ orderBy: { name: "asc" } }),
    prisma.tag.findMany({ orderBy: { name: "asc" } })
  ]);
  const attributeOptions: AttributeOption[] = attributes;
  const categoryOptions = buildCategoryOptions(categories);

  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-semibold text-admin-text">Yeni Ürün</h1>
      <ProductFeedback hata={hata} />
      <form id="product-form" action={createProduct} className="mt-8 space-y-6">
        <Card title="Temel Bilgiler">
          <div className="space-y-4">
            <div>
              <label className={labelClass}>Ürün Adı</label>
              <input name="name" required className={`mt-1 ${inputClass}`} />
            </div>
            <div>
              <label className={labelClass}>URL Uzantısı (slug)</label>
              <input name="slug" required placeholder="örn. siyah-mont" className={`mt-1 ${inputClass}`} />
            </div>
            <div>
              <label className={labelClass}>Açıklama</label>
              <textarea name="description" required rows={4} className={`mt-1 ${inputClass}`} />
            </div>
          </div>
        </Card>

        <Card title="Fiyatlandırma">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Fiyat (TL)</label>
              <input name="price" required type="number" step="0.01" className={`mt-1 ${inputClass}`} />
            </div>
            <div>
              <label className={labelClass}>İndirim Öncesi Fiyat (TL, opsiyonel)</label>
              <input name="compareAt" type="number" step="0.01" className={`mt-1 ${inputClass}`} />
            </div>
          </div>
        </Card>

        <Card title="Varyantlar">
          <VariantEditor
            fieldName="variantsJson"
            colorImagesFieldName="colorImagesJson"
            initialRows={[]}
            initialColorImages={{}}
            attributes={attributeOptions}
            defaultPriceLabel="ürün fiyatı"
            defaultCompareAtLabel="Boş = indirim gösterilmez"
          />
        </Card>

        <Card title="Görseller">
          <ProductImagesField name="images" initialImages={[]} />
        </Card>

        <Card title="Ürün Detayları">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Materyal</label>
                <input name="material" placeholder="örn. %95 Pamuk, %5 Elastan" className={`mt-1 ${inputClass}`} />
              </div>
              <div>
                <label className={labelClass}>Menşei</label>
                <input name="origin" placeholder="örn. Türkiye'de üretilmiştir" className={`mt-1 ${inputClass}`} />
              </div>
            </div>
            <div>
              <label className={labelClass}>Bakım Talimatı</label>
              <textarea
                name="careInstructions"
                rows={2}
                placeholder="örn. 30°C'de yıkayın, ütülemeyin"
                className={`mt-1 ${inputClass}`}
              />
            </div>
            <div>
              <label className={labelClass}>Cinsiyet</label>
              <select name="gender" defaultValue="" className={`mt-1 ${inputClass}`}>
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
                <TagsField fieldName="tagIds" allTags={tags} initialSelectedIds={[]} />
              </div>
            </div>
          </div>
        </Card>

        <Card title="Kategori ve Durum">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Kategori</label>
              <select name="categoryId" defaultValue="" className={`mt-1 ${inputClass}`}>
                <option value="">Kategori seç (opsiyonel)</option>
                {categoryOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Marka</label>
              <select name="brandId" defaultValue="" className={`mt-1 ${inputClass}`}>
                <option value="">Marka seç (opsiyonel)</option>
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Durum</label>
              <select name="status" defaultValue="DRAFT" className={`mt-1 ${inputClass}`}>
                <option value="DRAFT">Taslak</option>
                <option value="PUBLISHED">Yayında</option>
              </select>
            </div>
            <div className="flex items-end pb-2.5">
              <label className="flex items-center gap-2 text-sm text-admin-text">
                <input
                  type="checkbox"
                  name="isFeatured"
                  className="h-4 w-4 rounded border-admin-border text-admin-accent focus:ring-admin-accent"
                />
                Öne Çıkan Ürün
              </label>
            </div>
          </div>
        </Card>

        <button className="w-full rounded-md bg-admin-accent py-3 text-sm font-medium text-white hover:bg-indigo-700">
          Ürünü Kaydet
        </button>

        <SaveBar formId="product-form" />
      </form>
    </div>
  );
}
