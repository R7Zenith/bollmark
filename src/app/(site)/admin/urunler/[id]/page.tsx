import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

async function updateProduct(id: string, formData: FormData) {
  "use server";
  const name = String(formData.get("name") || "").trim();
  const description = String(formData.get("description") || "");
  const priceCents = Math.round(Number(formData.get("price") || 0) * 100);
  const status = String(formData.get("status") || "DRAFT") as "DRAFT" | "PUBLISHED" | "ARCHIVED";

  await prisma.product.update({
    where: { id },
    data: { name, description, priceCents, status }
  });
  redirect("/admin/urunler");
}

async function deleteProduct(id: string) {
  "use server";
  await prisma.product.delete({ where: { id } });
  redirect("/admin/urunler");
}

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = await prisma.product.findUnique({
    where: { id },
    include: { variants: true, images: true }
  });
  if (!product) notFound();

  const updateWithId = updateProduct.bind(null, product.id);
  const deleteWithId = deleteProduct.bind(null, product.id);

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold text-admin-text">Urunu Duzenle</h1>
      <form action={updateWithId} className="mt-8 space-y-5">
        <input
          name="name"
          defaultValue={product.name}
          required
          className="w-full rounded-md border border-admin-border px-4 py-3 focus:border-admin-accent focus:outline-none focus:ring-1 focus:ring-admin-accent"
        />
        <textarea
          name="description"
          defaultValue={product.description}
          rows={4}
          className="w-full rounded-md border border-admin-border px-4 py-3 focus:border-admin-accent focus:outline-none focus:ring-1 focus:ring-admin-accent"
        />
        <div className="grid grid-cols-2 gap-4">
          <input
            name="price"
            type="number"
            step="0.01"
            defaultValue={(product.priceCents / 100).toFixed(2)}
            className="rounded-md border border-admin-border px-4 py-3 focus:border-admin-accent focus:outline-none focus:ring-1 focus:ring-admin-accent"
          />
          <select
            name="status"
            defaultValue={product.status}
            className="rounded-md border border-admin-border px-4 py-3 focus:border-admin-accent focus:outline-none focus:ring-1 focus:ring-admin-accent"
          >
            <option value="DRAFT">Taslak</option>
            <option value="PUBLISHED">Yayinda</option>
            <option value="ARCHIVED">Arsiv</option>
          </select>
        </div>
        <button className="w-full rounded-md bg-admin-accent py-3 text-sm font-medium text-white hover:bg-indigo-700">
          Degisiklikleri Kaydet
        </button>
      </form>

      <div className="mt-8 border-t border-admin-border pt-6">
        <p className="text-xs uppercase tracking-wide text-admin-text-muted">Varyantlar</p>
        <ul className="mt-2 space-y-1 text-sm text-admin-text">
          {product.variants.map((v) => (
            <li key={v.id}>
              {v.size} / {v.color} — SKU {v.sku} — Stok: {v.stock}
            </li>
          ))}
        </ul>
      </div>

      <form action={deleteWithId} className="mt-8">
        <button className="rounded-md border border-red-600 px-5 py-2 text-sm font-medium text-red-600 hover:bg-red-600 hover:text-white">
          Urunu Sil
        </button>
      </form>
    </div>
  );
}
