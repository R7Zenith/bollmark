import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-admin";
import { Card } from "@/components/admin/card";
import { CategoryFormFields } from "@/components/admin/category-form-fields";
import { CategoryFeedback } from "@/components/admin/category-feedback";
import { CategoryManager, type CategoryRowData } from "@/components/admin/category-manager";
import { buildCategoryOptions, isDescendantOf } from "@/lib/category-tree";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9ığüşöç\s-]/gi, "")
    .replace(/\s+/g, "-");
}

function readCategoryFields(formData: FormData) {
  return {
    imageUrl: String(formData.get("imageUrl") || "").trim() || null,
    description: String(formData.get("description") || "").trim() || null,
    metaTitle: String(formData.get("metaTitle") || "").trim() || null,
    metaDescription: String(formData.get("metaDescription") || "").trim() || null,
    isActive: formData.get("isActive") === "on"
  };
}

async function createCategory(formData: FormData) {
  "use server";
  const name = String(formData.get("name") || "").trim();
  if (!name) redirect("/admin/kategoriler?hata=isim-gerekli");
  const parentId = String(formData.get("parentId") || "") || null;
  const sizeGuide = String(formData.get("sizeGuide") || "").trim() || null;
  await prisma.category.create({
    data: { name, slug: slugify(name), parentId, sizeGuide, ...readCategoryFields(formData) }
  });
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

  await prisma.category.update({
    where: { id },
    data: { name, slug: slugify(name), parentId, sizeGuide, ...readCategoryFields(formData) }
  });
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

async function reassignProductsAndDeleteCategory(id: string, formData: FormData) {
  "use server";
  const targetCategoryId = String(formData.get("targetCategoryId") || "") || null;
  if (targetCategoryId === id) redirect("/admin/kategoriler?hata=kendine-bagli");

  const category = await prisma.category.findUnique({
    where: { id },
    include: { _count: { select: { children: true } } }
  });
  if (!category) redirect("/admin/kategoriler?hata=bulunamadi");
  if (category._count.children > 0) redirect("/admin/kategoriler?hata=alt-kategori-bagli");

  await prisma.$transaction([
    prisma.product.updateMany({ where: { categoryId: id }, data: { categoryId: targetCategoryId } }),
    prisma.category.delete({ where: { id } })
  ]);
  redirect("/admin/kategoriler?basarili=tasindi-ve-silindi");
}

export default async function AdminCategoriesPage({
  searchParams
}: {
  searchParams: Promise<{ basarili?: string; hata?: string }>;
}) {
  await requireAdmin();
  const { basarili, hata } = await searchParams;
  const categories = await prisma.category.findMany({
    include: { _count: { select: { products: true } } },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }]
  });
  const orderedCategories = buildCategoryOptions(categories);
  const allParentOptions = orderedCategories.map((c) => ({ id: c.id, label: c.label }));

  const rows: CategoryRowData[] = orderedCategories.map(({ id, depth, category }) => ({
    id,
    name: category.name,
    depth,
    productCount: category._count.products,
    parentId: category.parentId,
    sizeGuide: category.sizeGuide,
    imageUrl: category.imageUrl,
    description: category.description,
    metaTitle: category.metaTitle,
    metaDescription: category.metaDescription,
    isActive: category.isActive,
    parentOptions: allParentOptions.filter((p) => p.id !== id),
    updateAction: updateCategory.bind(null, id),
    deleteAction: deleteCategory.bind(null, id),
    reassignAction: reassignProductsAndDeleteCategory.bind(null, id)
  }));

  return (
    <div>
      <h1 className="text-2xl font-semibold text-admin-text">Kategoriler</h1>

      <CategoryFeedback basarili={basarili} hata={hata} />

      <Card title="Yeni Kategori" className="mt-6 max-w-lg">
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
          <CategoryFormFields inputClassName="w-full rounded-md border border-admin-border px-4 py-2 text-sm focus:border-admin-accent focus:outline-none focus:ring-1 focus:ring-admin-accent" />
          <button className="w-full rounded-md bg-admin-accent px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700">
            Ekle
          </button>
        </form>
      </Card>

      <div className="mt-6">
        <CategoryManager items={rows} />
      </div>
    </div>
  );
}
