import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/admin/card";
import { SaveBar } from "@/components/admin/save-bar";
import { ProductFeedback } from "@/components/admin/product-feedback";
import { DeleteProductForm } from "@/components/admin/delete-product-form";

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
  // Varyant satiri formati: Beden,Renk,SKU,Stok
  const variantLines = String(formData.get("variants") || "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

  try {
    await prisma.$transaction([
      prisma.product.update({
        where: { id },
        data: { name, slug, description, priceCents, compareAtCents, categoryId, status }
      }),
      prisma.productImage.deleteMany({ where: { productId: id } }),
      prisma.productImage.createMany({
        data: imageUrls.map((url, i) => ({ productId: id, url, position: i }))
      }),
      prisma.productVariant.deleteMany({ where: { productId: id } }),
      prisma.productVariant.createMany({
        data: variantLines.map((line) => {
          const [size, color, sku, stock] = line.split(",").map((p) => p.trim());
          return {
            productId: id,
            size: size || "TEK EBAT",
            color: color || "STANDART",
            sku: sku || `${slug}-${Math.random().toString(36).slice(2, 8)}`,
            stock: Number(stock || 0)
          };
        })
      })
    ]);
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
  const [product, categories] = await Promise.all([
    prisma.product.findUnique({
      where: { id },
      include: { variants: true, images: { orderBy: { position: "asc" } } }
    }),
    prisma.category.findMany({ orderBy: { name: "asc" } })
  ]);
  if (!product) notFound();

  const updateWithId = updateProduct.bind(null, product.id);
  const deleteWithId = deleteProduct.bind(null, product.id);
  const imagesValue = product.images.map((i) => i.url).join("\n");
  const variantsValue = product.variants.map((v) => `${v.size},${v.color},${v.sku},${v.stock}`).join("\n");

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold text-admin-text">Urunu Duzenle</h1>

      <ProductFeedback basarili={basarili} hata={hata} />

      <form id="product-form" action={updateWithId} className="mt-8 space-y-6">
        <Card title="Temel Bilgiler">
          <div className="space-y-4">
            <div>
              <label className={labelClass}>Urun Adi</label>
              <input name="name" defaultValue={product.name} required className={`mt-1 ${inputClass}`} />
            </div>
            <div>
              <label className={labelClass}>URL Uzantisi (slug)</label>
              <input name="slug" defaultValue={product.slug} required className={`mt-1 ${inputClass}`} />
            </div>
            <div>
              <label className={labelClass}>Aciklama</label>
              <textarea name="description" defaultValue={product.description} rows={4} className={`mt-1 ${inputClass}`} />
            </div>
          </div>
        </Card>

        <Card title="Fiyatlandirma">
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
              <label className={labelClass}>Indirim Oncesi Fiyat (TL, opsiyonel)</label>
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
          <label className={labelClass}>Her satira: Beden,Renk,SKU,Stok</label>
          <textarea
            name="variants"
            defaultValue={variantsValue}
            rows={4}
            className={`mt-1 ${inputClass} font-mono`}
            placeholder={"M,Siyah,BLM-001-M-SYH,10\nL,Siyah,BLM-001-L-SYH,8"}
          />
        </Card>

        <Card title="Gorseller">
          <label className={labelClass}>Gorsel URL&apos;leri (her satira bir tane)</label>
          <textarea name="images" defaultValue={imagesValue} rows={3} className={`mt-1 ${inputClass}`} placeholder="https://..." />
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
                <option value="PUBLISHED">Yayinda</option>
                <option value="ARCHIVED">Arsiv</option>
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
