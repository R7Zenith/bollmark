import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/admin/card";
import { CategoryRow } from "@/components/admin/category-row";
import { CategoryFeedback } from "@/components/admin/category-feedback";
import { buildCategoryOptions, isDescendantOf } from "@/lib/category-tree";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9ığüşöç\s-]/gi, "")
    .replace(/\s+/g, "-");
}

async function createCategory(formData: FormData) {
  "use server";
  const name = String(formData.get("name") || "").trim();
  if (!name) redirect("/admin/kategoriler?hata=isim-gerekli");
  const parentId = String(formData.get("parentId") || "") || null;
  const sizeGuide = String(formData.get("sizeGuide") || "").trim() || null;
  await prisma.category.create({ data: { name, slug: slugify(name), parentId, sizeGuide } });
  redirect("/admin/kategoriler?basarili=eklendi");
}

async function updateCategory(id: string, formData: FormData) {
  "use server";
  const name = String(formData.get("name") || "").trim();
  if (!name) redirect("/admin/kategoriler?hata=isim-gerekli");
  const parentId = String(formData.get("parentId") || "") || null;
  const sizeGuide = String(formData.get("sizeGuide") || "").trim() || null;

  if (parentId === id) redirect("/admin/kategoriler?hata=kendine-bagli");
  if (parentId) {
    const all = await prisma.category.findMany({ select: { id: true, parentId: true } });
    if (isDescendantOf(all, id, parentId)) redirect("/admin/kategoriler?hata=dongu");
  }

  await prisma.category.update({ where: { id }, data: { name, slug: slugify(name), parentId, sizeGuide } });
  redirect("/admin/kategoriler?basarili=guncellendi");
}

async function deleteCategory(id: string) {
  "use server";
  const category = await prisma.category.findUnique({
    where: { id },
    include: { _count: { select: { products: true, children: true } } }
  });
  if (!category) redirect("/admin/kategoriler?hata=bulunamadi");
  if (category._count.products > 0) redirect("/admin/kategoriler?hata=urun-bagli");
  if (category._count.children > 0) redirect("/admin/kategoriler?hata=alt-kategori-bagli");
  await prisma.category.delete({ where: { id } });
  redirect("/admin/kategoriler?basarili=silindi");
}

export default async function AdminCategoriesPage({
  searchParams
}: {
  searchParams: Promise<{ basarili?: string; hata?: string }>;
}) {
  const { basarili, hata } = await searchParams;
  const categories = await prisma.category.findMany({
    include: { _count: { select: { products: true } } },
    orderBy: { name: "asc" }
  });
  const orderedCategories = buildCategoryOptions(categories);
  const allParentOptions = buildCategoryOptions(categories).map((c) => ({ id: c.id, label: c.label }));

  return (
    <div className="max-w-md">
      <h1 className="text-2xl font-semibold text-admin-text">Kategoriler</h1>

      <CategoryFeedback basarili={basarili} hata={hata} />

      <Card title="Yeni Kategori" className="mt-6">
        <form action={createCategory} className="space-y-3">
          <input
            name="name"
            required
            placeholder="Kategori adı"
            className="w-full rounded-md border border-admin-border px-4 py-2 text-sm focus:border-admin-accent focus:outline-none focus:ring-1 focus:ring-admin-accent"
          />
          <select
            name="parentId"
            defaultValue=""
            className="w-full rounded-md border border-admin-border px-4 py-2 text-sm focus:border-admin-accent focus:outline-none focus:ring-1 focus:ring-admin-accent"
          >
            <option value="">Üst kategori yok</option>
            {allParentOptions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
          <textarea
            name="sizeGuide"
            rows={3}
            placeholder="Beden tablosu (opsiyonel)"
            className="w-full rounded-md border border-admin-border px-4 py-2 text-sm focus:border-admin-accent focus:outline-none focus:ring-1 focus:ring-admin-accent"
          />
          <button className="w-full rounded-md bg-admin-accent px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700">
            Ekle
          </button>
        </form>
      </Card>

      <ul className="mt-6 divide-y divide-admin-border rounded-lg border border-admin-border bg-admin-surface">
        {orderedCategories.map(({ id, depth, category }) => (
          <CategoryRow
            key={id}
            name={category.name}
            depth={depth}
            productCount={category._count.products}
            parentId={category.parentId}
            sizeGuide={category.sizeGuide}
            parentOptions={allParentOptions.filter((p) => p.id !== id)}
            updateAction={updateCategory.bind(null, id)}
            deleteAction={deleteCategory.bind(null, id)}
          />
        ))}
        {orderedCategories.length === 0 && (
          <li className="px-4 py-6 text-center text-sm text-admin-text-muted">Henüz kategori yok.</li>
        )}
      </ul>
    </div>
  );
}
