import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-admin";
import { Card } from "@/components/admin/card";
import { CategoryFormFields } from "@/components/admin/category-form-fields";
import { CategoryFeedback } from "@/components/admin/category-feedback";
import { CategoryManager, type CategoryRowData } from "@/components/admin/category-manager";
import { buildCategoryOptions } from "@/lib/category-tree";
import {
  createCategory,
  deleteCategory,
  reassignProductsAndDeleteCategory
} from "@/lib/category-actions";

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
