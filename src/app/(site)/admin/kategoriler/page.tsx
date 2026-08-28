import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

async function createCategory(formData: FormData) {
  "use server";
  const name = String(formData.get("name") || "").trim();
  if (!name) return;
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9ığüşöç\s-]/gi, "")
    .replace(/\s+/g, "-");
  await prisma.category.create({ data: { name, slug } });
  revalidatePath("/admin/kategoriler");
}

export default async function AdminCategoriesPage() {
  const categories = await prisma.category.findMany({
    include: { _count: { select: { products: true } } },
    orderBy: { name: "asc" }
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold text-admin-text">Kategoriler</h1>

      <form action={createCategory} className="mt-6 flex max-w-md gap-3">
        <input
          name="name"
          required
          placeholder="Yeni kategori adi"
          className="flex-1 rounded-md border border-admin-border px-4 py-2 text-sm focus:border-admin-accent focus:outline-none focus:ring-1 focus:ring-admin-accent"
        />
        <button className="rounded-md bg-admin-accent px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700">
          Ekle
        </button>
      </form>

      <ul className="mt-8 max-w-md divide-y divide-admin-border rounded-lg border border-admin-border bg-admin-surface">
        {categories.map((c) => (
          <li key={c.id} className="flex items-center justify-between px-4 py-3 text-sm text-admin-text">
            <span>{c.name}</span>
            <span className="text-admin-text-muted">{c._count.products} urun</span>
          </li>
        ))}
        {categories.length === 0 && (
          <li className="px-4 py-6 text-center text-sm text-admin-text-muted">Henuz kategori yok.</li>
        )}
      </ul>
    </div>
  );
}
