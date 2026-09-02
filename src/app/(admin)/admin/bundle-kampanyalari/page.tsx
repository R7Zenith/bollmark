import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-admin";
import { Card } from "@/components/admin/card";
import { BundleRow, type BundleData } from "@/components/admin/bundle-row";
import { BundleFeedback } from "@/components/admin/bundle-feedback";
import { NewBundleForm } from "@/components/admin/new-bundle-form";

const PATH = "/admin/bundle-kampanyalari";

function parseProductIdsJson(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

async function createBundle(formData: FormData) {
  "use server";
  const name = String(formData.get("name") || "").trim();
  const discountPercent = Math.max(1, Math.min(90, Math.round(Number(formData.get("discountPercent") || 0))));
  const productIds = parseProductIdsJson(String(formData.get("productIds") || "[]"));
  const isActive = formData.get("isActive") === "on";

  if (!name) redirect(`${PATH}?hata=ad-gerekli`);
  if (productIds.length < 2) redirect(`${PATH}?hata=urun-yetersiz`);

  await prisma.bundle.create({
    data: { name, discountPercent, isActive, products: { connect: productIds.map((id) => ({ id })) } }
  });
  redirect(`${PATH}?basarili=eklendi`);
}

async function updateBundle(id: string, formData: FormData) {
  "use server";
  const name = String(formData.get("name") || "").trim();
  const discountPercent = Math.max(1, Math.min(90, Math.round(Number(formData.get("discountPercent") || 0))));
  const productIds = parseProductIdsJson(String(formData.get("productIds") || "[]"));
  const isActive = formData.get("isActive") === "on";

  if (!name) redirect(`${PATH}?hata=ad-gerekli`);
  if (productIds.length < 2) redirect(`${PATH}?hata=urun-yetersiz`);

  await prisma.bundle.update({
    where: { id },
    data: { name, discountPercent, isActive, products: { set: productIds.map((pid) => ({ id: pid })) } }
  });
  redirect(`${PATH}?basarili=guncellendi`);
}

async function deleteBundle(id: string) {
  "use server";
  await prisma.bundle.delete({ where: { id } }).catch(() => null);
  redirect(`${PATH}?basarili=silindi`);
}

export default async function AdminBundleKampanyalariPage({
  searchParams
}: {
  searchParams: Promise<{ basarili?: string; hata?: string }>;
}) {
  await requireAdmin();
  const { basarili, hata } = await searchParams;

  const [bundles, products] = await Promise.all([
    prisma.bundle.findMany({ include: { products: { select: { id: true, name: true } } }, orderBy: { createdAt: "desc" } }),
    prisma.product.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } })
  ]);

  const rows: BundleData[] = bundles.map((b) => ({
    id: b.id,
    name: b.name,
    discountPercent: b.discountPercent,
    isActive: b.isActive,
    productIds: b.products.map((p) => p.id),
    productNames: b.products.map((p) => p.name)
  }));

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold text-admin-text">Bundle Kampanyaları</h1>
      <p className="mt-1 text-sm text-admin-text-muted">
        Bir bundle&apos;a dahil tüm ürünlerden en az 1&apos;er adet sepette olduğunda, bu ürünlerin toplamına indirim uygulanır.
      </p>

      <BundleFeedback basarili={basarili} hata={hata} />

      <Card title="Yeni Bundle" className="mt-6">
        <NewBundleForm allProducts={products} createAction={createBundle} />
      </Card>

      <ul className="mt-6 divide-y divide-admin-border rounded-lg border border-admin-border bg-admin-surface">
        {rows.map((b) => (
          <BundleRow
            key={b.id}
            bundle={b}
            allProducts={products}
            updateAction={updateBundle.bind(null, b.id)}
            deleteAction={deleteBundle.bind(null, b.id)}
          />
        ))}
        {rows.length === 0 && <li className="px-4 py-6 text-center text-sm text-admin-text-muted">Henüz bundle yok.</li>}
      </ul>
    </div>
  );
}
