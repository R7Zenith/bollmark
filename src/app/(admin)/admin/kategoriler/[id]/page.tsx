import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-admin";
import { Card } from "@/components/admin/card";
import { SaveBar } from "@/components/admin/save-bar";
import { CategoryFeedback } from "@/components/admin/category-feedback";
import { CategoryFormFields } from "@/components/admin/category-form-fields";
import { CategoryDeleteForm } from "@/components/admin/category-delete-form";
import { buildCategoryOptions } from "@/lib/category-tree";
import { updateCategory, deleteCategory, reassignProductsAndDeleteCategory } from "@/lib/category-actions";

const inputClass =
  "w-full rounded-md border border-admin-border px-4 py-2.5 text-sm focus:border-admin-accent focus:outline-none focus:ring-1 focus:ring-admin-accent";
const labelClass = "text-xs font-medium uppercase tracking-wide text-admin-text-muted";

export default async function CategoryDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ basarili?: string; hata?: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const { basarili, hata } = await searchParams;

  const [category, categories] = await Promise.all([
    prisma.category.findUnique({
      where: { id },
      include: { _count: { select: { products: true } } }
    }),
    prisma.category.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] })
  ]);
  if (!category) notFound();

  const orderedCategories = buildCategoryOptions(categories);
  const parentOptions = orderedCategories
    .filter((c) => c.id !== id)
    .map((c) => ({ id: c.id, label: c.label }));

  const updateWithId = updateCategory.bind(null, id, `/admin/kategoriler/${id}`);
  const deleteWithId = deleteCategory.bind(null, id);
  const reassignWithId = reassignProductsAndDeleteCategory.bind(null, id);

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold text-admin-text">Kategoriyi Düzenle</h1>

      <CategoryFeedback basarili={basarili} hata={hata} redirectTo={`/admin/kategoriler/${id}`} />

      <form id="category-form" action={updateWithId} className="mt-8 space-y-6">
        <Card title="Temel Bilgiler">
          <div className="space-y-4">
            <div>
              <label className={labelClass}>Kategori Adı</label>
              <input name="name" defaultValue={category.name} required className={`mt-1 ${inputClass}`} />
            </div>
            <div>
              <label className={labelClass}>Üst Kategori</label>
              <select name="parentId" defaultValue={category.parentId ?? ""} className={`mt-1 ${inputClass}`}>
                <option value="">Üst kategori yok</option>
                {parentOptions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Beden Tablosu</label>
              <textarea
                name="sizeGuide"
                defaultValue={category.sizeGuide ?? ""}
                rows={3}
                placeholder="Beden tablosu (opsiyonel)"
                className={`mt-1 ${inputClass}`}
              />
            </div>
          </div>
        </Card>

        <Card title="Görsel, Açıklama ve SEO">
          <div className="space-y-3">
            <CategoryFormFields
              imageUrl={category.imageUrl}
              description={category.description}
              metaTitle={category.metaTitle}
              metaDescription={category.metaDescription}
              isActive={category.isActive}
              inputClassName={inputClass}
            />
          </div>
        </Card>

        <SaveBar formId="category-form" />
      </form>

      <div className="mt-8 border-t border-admin-border pt-6">
        <CategoryDeleteForm
          name={category.name}
          productCount={category._count.products}
          parentOptions={parentOptions}
          deleteAction={deleteWithId}
          reassignAction={reassignWithId}
        />
      </div>
    </div>
  );
}
