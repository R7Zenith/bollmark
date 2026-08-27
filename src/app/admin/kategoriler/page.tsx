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
      <h1 className="font-display text-3xl">Kategoriler</h1>

      <form action={createCategory} className="mt-6 flex max-w-md gap-3">
        <input
          name="name"
          required
          placeholder="Yeni kategori adi"
          className="flex-1 border border-line px-4 py-2 text-sm"
        />
        <button className="bg-ink px-5 py-2 text-sm uppercase text-paper hover:bg-accent">Ekle</button>
      </form>

      <ul className="mt-8 max-w-md divide-y divide-line bg-white">
        {categories.map((c) => (
          <li key={c.id} className="flex items-center justify-between px-4 py-3 text-sm">
            <span>{c.name}</span>
            <span className="text-ink/50">{c._count.products} urun</span>
          </li>
        ))}
        {categories.length === 0 && (
          <li className="px-4 py-6 text-center text-sm text-ink/50">Henuz kategori yok.</li>
        )}
      </ul>
    </div>
  );
}
