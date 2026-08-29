import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/admin/card";
import { SaveBar } from "@/components/admin/save-bar";

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
  // Varyant satiri formati: Beden,Renk,SKU,Stok
  const variantLines = String(formData.get("variants") || "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

  const product = await prisma.product.create({
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
      },
      variants: {
        create: variantLines.map((line) => {
          const [size, color, sku, stock] = line.split(",").map((p) => p.trim());
          return {
            size: size || "TEK EBAT",
            color: color || "STANDART",
            sku: sku || `${slug}-${Math.random().toString(36).slice(2, 8)}`,
            stock: Number(stock || 0)
          };
        })
      }
    }
  });

  redirect(`/admin/urunler/${product.id}?basarili=olusturuldu`);
}

export default async function NewProductPage() {
  const categories = await prisma.category.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold text-admin-text">Yeni Urun</h1>
      <form id="product-form" action={createProduct} className="mt-8 space-y-6">
        <Card title="Temel Bilgiler">
          <div className="space-y-4">
            <div>
              <label className={labelClass}>Urun Adi</label>
              <input name="name" required className={`mt-1 ${inputClass}`} />
            </div>
            <div>
              <label className={labelClass}>URL Uzantisi (slug)</label>
              <input name="slug" required placeholder="orn. siyah-mont" className={`mt-1 ${inputClass}`} />
            </div>
            <div>
              <label className={labelClass}>Aciklama</label>
              <textarea name="description" required rows={4} className={`mt-1 ${inputClass}`} />
            </div>
          </div>
        </Card>

        <Card title="Fiyatlandirma">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Fiyat (TL)</label>
              <input name="price" required type="number" step="0.01" className={`mt-1 ${inputClass}`} />
            </div>
            <div>
              <label className={labelClass}>Indirim Oncesi Fiyat (TL, opsiyonel)</label>
              <input name="compareAt" type="number" step="0.01" className={`mt-1 ${inputClass}`} />
            </div>
          </div>
        </Card>

        <Card title="Varyantlar">
          <label className={labelClass}>Her satira: Beden,Renk,SKU,Stok</label>
          <textarea
            name="variants"
            rows={4}
            className={`mt-1 ${inputClass} font-mono`}
            placeholder={"M,Siyah,BLM-001-M-SYH,10\nL,Siyah,BLM-001-L-SYH,8"}
          />
        </Card>

        <Card title="Gorseller">
          <label className={labelClass}>Gorsel URL&apos;leri (her satira bir tane)</label>
          <textarea name="images" rows={3} className={`mt-1 ${inputClass}`} placeholder="https://..." />
        </Card>

        <Card title="Kategori ve Durum">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Kategori</label>
              <select name="categoryId" defaultValue="" className={`mt-1 ${inputClass}`}>
                <option value="">Kategori sec (opsiyonel)</option>
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
                <option value="PUBLISHED">Yayinda</option>
              </select>
            </div>
          </div>
        </Card>

        <button className="w-full rounded-md bg-admin-accent py-3 text-sm font-medium text-white hover:bg-indigo-700">
          Urunu Kaydet
        </button>

        <SaveBar formId="product-form" />
      </form>
    </div>
  );
}
