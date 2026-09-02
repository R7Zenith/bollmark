import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-admin";
import { Card } from "@/components/admin/card";
import { BrandRow } from "@/components/admin/brand-row";
import { BrandFeedback } from "@/components/admin/brand-feedback";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9ığüşöç\s-]/gi, "")
    .replace(/\s+/g, "-");
}

async function createBrand(formData: FormData) {
  "use server";
  const name = String(formData.get("name") || "").trim();
  if (!name) redirect("/admin/markalar?hata=isim-gerekli");
  await prisma.brand.create({ data: { name, slug: slugify(name) } });
  redirect("/admin/markalar?basarili=eklendi");
}

async function updateBrand(id: string, formData: FormData) {
  "use server";
  const name = String(formData.get("name") || "").trim();
  if (!name) redirect("/admin/markalar?hata=isim-gerekli");
  await prisma.brand.update({ where: { id }, data: { name, slug: slugify(name) } });
  redirect("/admin/markalar?basarili=guncellendi");
}

async function deleteBrand(id: string) {
  "use server";
  const brand = await prisma.brand.findUnique({
    where: { id },
    include: { _count: { select: { products: true } } }
  });
  if (!brand) redirect("/admin/markalar?hata=bulunamadi");
  if (brand._count.products > 0) redirect("/admin/markalar?hata=urun-bagli");
  await prisma.brand.delete({ where: { id } });
  redirect("/admin/markalar?basarili=silindi");
}

export default async function AdminBrandsPage({
  searchParams
}: {
  searchParams: Promise<{ basarili?: string; hata?: string }>;
}) {
  await requireAdmin();
  const { basarili, hata } = await searchParams;
  const brands = await prisma.brand.findMany({
    include: { _count: { select: { products: true } } },
    orderBy: { name: "asc" }
  });

  return (
    <div className="max-w-md">
      <h1 className="text-2xl font-semibold text-admin-text">Markalar</h1>

      <BrandFeedback basarili={basarili} hata={hata} />

      <Card title="Yeni Marka" className="mt-6">
        <form action={createBrand} className="flex gap-3">
          <input
            name="name"
            required
            placeholder="Marka adı"
            className="flex-1 rounded-md border border-admin-border px-4 py-2 text-sm focus:border-admin-accent focus:outline-none focus:ring-1 focus:ring-admin-accent"
          />
          <button className="rounded-md bg-admin-accent px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700">
            Ekle
          </button>
        </form>
      </Card>

      <ul className="mt-6 divide-y divide-admin-border rounded-lg border border-admin-border bg-admin-surface">
        {brands.map((b) => (
          <BrandRow
            key={b.id}
            name={b.name}
            productCount={b._count.products}
            updateAction={updateBrand.bind(null, b.id)}
            deleteAction={deleteBrand.bind(null, b.id)}
          />
        ))}
        {brands.length === 0 && (
          <li className="px-4 py-6 text-center text-sm text-admin-text-muted">Henüz marka yok.</li>
        )}
      </ul>
    </div>
  );
}
