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

export default async function EditProductPage({ params }: { params: { id: string } }) {
  const product = await prisma.product.findUnique({
    where: { id: params.id },
    include: { variants: true, images: true }
  });
  if (!product) notFound();

  const updateWithId = updateProduct.bind(null, product.id);
  const deleteWithId = deleteProduct.bind(null, product.id);

  return (
    <div className="max-w-2xl">
      <h1 className="font-display text-3xl">Urunu Duzenle</h1>
      <form action={updateWithId} className="mt-8 space-y-5">
        <input name="name" defaultValue={product.name} required className="w-full border border-line px-4 py-3" />
        <textarea
          name="description"
          defaultValue={product.description}
          rows={4}
          className="w-full border border-line px-4 py-3"
        />
        <div className="grid grid-cols-2 gap-4">
          <input
            name="price"
            type="number"
            step="0.01"
            defaultValue={(product.priceCents / 100).toFixed(2)}
            className="border border-line px-4 py-3"
          />
          <select name="status" defaultValue={product.status} className="border border-line px-4 py-3">
            <option value="DRAFT">Taslak</option>
            <option value="PUBLISHED">Yayinda</option>
            <option value="ARCHIVED">Arsiv</option>
          </select>
        </div>
        <button className="w-full bg-ink py-3 text-sm uppercase tracking-widest2 text-paper hover:bg-accent">
          Degisiklikleri Kaydet
        </button>
      </form>

      <div className="mt-8 border-t border-line pt-6">
        <p className="text-xs uppercase tracking-wide text-ink/50">Varyantlar</p>
        <ul className="mt-2 space-y-1 text-sm">
          {product.variants.map((v) => (
            <li key={v.id}>
              {v.size} / {v.color} — SKU {v.sku} — Stok: {v.stock}
            </li>
          ))}
        </ul>
      </div>

      <form action={deleteWithId} className="mt-8">
        <button className="border border-red-600 px-5 py-2 text-sm uppercase tracking-wide text-red-600 hover:bg-red-600 hover:text-white">
          Urunu Sil
        </button>
      </form>
    </div>
  );
}
