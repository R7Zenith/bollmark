import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/admin/card";
import { SaveBar } from "@/components/admin/save-bar";
import { ProductFeedback } from "@/components/admin/product-feedback";
import { VariantEditor, type AttributeOption, type SerializedVariant } from "@/components/admin/variant-editor";

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
          : null,
      imageUrl: typeof v.imageUrl === "string" && v.imageUrl.trim() ? v.imageUrl.trim() : null
    }));
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
  const imageUrls = String(formData.get("images") || "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  const variants = parseVariantsJson(String(formData.get("variantsJson") || "[]"));

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
          images: {
            create: imageUrls.map((url, i) => ({ url, position: i }))
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
            imageUrl: v.imageUrl,
            options: { create: v.optionValueIds.map((valueId) => ({ valueId })) }
          }
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
  const { hata } = await searchParams;
  const [categories, attributes] = await Promise.all([
    prisma.category.findMany({ orderBy: { name: "asc" } }),
    prisma.variantAttribute.findMany({
      orderBy: { position: "asc" },
      include: { values: { orderBy: { position: "asc" } } }
    })
  ]);
  const attributeOptions: AttributeOption[] = attributes;

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
            initialRows={[]}
            attributes={attributeOptions}
            defaultPriceLabel="ürün fiyatı"
            defaultCompareAtLabel="Boş = indirim gösterilmez"
          />
        </Card>

        <Card title="Görseller">
          <label className={labelClass}>Görsel URL&apos;leri (her satıra bir tane)</label>
          <textarea name="images" rows={3} className={`mt-1 ${inputClass}`} placeholder="https://..." />
        </Card>

        <Card title="Kategori ve Durum">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Kategori</label>
              <select name="categoryId" defaultValue="" className={`mt-1 ${inputClass}`}>
                <option value="">Kategori seç (opsiyonel)</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
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
