import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

async function createProduct(formData: FormData) {
  "use server";

  const name = String(formData.get("name") || "").trim();
  const slug = String(formData.get("slug") || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-");
  const description = String(formData.get("description") || "");
  const priceCents = Math.round(Number(formData.get("price") || 0) * 100);
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

  redirect(`/admin/urunler/${product.id}`);
}

export default async function NewProductPage() {
  const categories = await prisma.category.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold text-admin-text">Yeni Urun</h1>
      <form action={createProduct} className="mt-8 space-y-5">
        <input
          name="name"
          required
          placeholder="Urun Adi"
          className="w-full rounded-md border border-admin-border px-4 py-3 focus:border-admin-accent focus:outline-none focus:ring-1 focus:ring-admin-accent"
        />
        <input
          name="slug"
          required
          placeholder="url-uzantisi (orn. siyah-mont)"
          className="w-full rounded-md border border-admin-border px-4 py-3 focus:border-admin-accent focus:outline-none focus:ring-1 focus:ring-admin-accent"
        />
        <textarea
          name="description"
          required
          placeholder="Aciklama"
          rows={4}
          className="w-full rounded-md border border-admin-border px-4 py-3 focus:border-admin-accent focus:outline-none focus:ring-1 focus:ring-admin-accent"
        />
        <div className="grid grid-cols-2 gap-4">
          <input
            name="price"
            required
            type="number"
            step="0.01"
            placeholder="Fiyat (TL)"
            className="rounded-md border border-admin-border px-4 py-3 focus:border-admin-accent focus:outline-none focus:ring-1 focus:ring-admin-accent"
          />
          <select
            name="status"
            className="rounded-md border border-admin-border px-4 py-3 focus:border-admin-accent focus:outline-none focus:ring-1 focus:ring-admin-accent"
          >
            <option value="DRAFT">Taslak</option>
            <option value="PUBLISHED">Yayinda</option>
          </select>
        </div>
        <select
          name="categoryId"
          className="w-full rounded-md border border-admin-border px-4 py-3 focus:border-admin-accent focus:outline-none focus:ring-1 focus:ring-admin-accent"
        >
          <option value="">Kategori sec (opsiyonel)</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <div>
          <label className="text-xs uppercase tracking-wide text-admin-text-muted">Gorsel URL&apos;leri (her satira bir tane)</label>
          <textarea
            name="images"
            rows={3}
            className="mt-1 w-full rounded-md border border-admin-border px-4 py-3 focus:border-admin-accent focus:outline-none focus:ring-1 focus:ring-admin-accent"
            placeholder="https://..."
          />
        </div>
        <div>
          <label className="text-xs uppercase tracking-wide text-admin-text-muted">
            Varyantlar - her satira: Beden,Renk,SKU,Stok
          </label>
          <textarea
            name="variants"
            rows={4}
            className="mt-1 w-full rounded-md border border-admin-border px-4 py-3 font-mono text-sm focus:border-admin-accent focus:outline-none focus:ring-1 focus:ring-admin-accent"
            placeholder={"M,Siyah,BLM-001-M-SYH,10\nL,Siyah,BLM-001-L-SYH,8"}
          />
        </div>
        <button className="w-full rounded-md bg-admin-accent py-3 text-sm font-medium text-white hover:bg-indigo-700">
          Urunu Kaydet
        </button>
      </form>
    </div>
  );
}
