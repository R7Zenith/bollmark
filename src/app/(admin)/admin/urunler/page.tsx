import Link from "next/link";
import { Plus, Package, FileSpreadsheet } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-admin";
import { Button } from "@/components/admin/button";
import { EmptyState } from "@/components/admin/empty-state";
import { ProductsFilters } from "@/components/admin/products-filters";
import { ProductsTable, type ProductRow } from "@/components/admin/products-table";

type SortKey = "name" | "price" | "stock" | "createdAt";
const sortKeys: SortKey[] = ["name", "price", "stock", "createdAt"];

interface SearchParams {
  q?: string;
  durum?: string;
  kategori?: string;
  sort?: string;
  dir?: string;
}

export default async function AdminProductsPage({
  searchParams
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireAdmin();
  const { q, durum, kategori, sort, dir } = await searchParams;

  const totalCount = await prisma.product.count();

  if (totalCount === 0) {
    return (
      <div>
        <h1 className="text-2xl font-semibold text-admin-text">Ürünler</h1>
        <div className="mt-8 rounded-lg border border-admin-border bg-admin-surface">
          <EmptyState
            icon={Package}
            title="Henüz ürün yok"
            description="Mağazana ilk ürününü ekleyerek başla."
            action={
              <div className="flex items-center gap-3">
                <Link href="/admin/urunler/excel-yukle">
                  <Button variant="secondary">
                    <FileSpreadsheet size={16} /> Excel'den Yükle
                  </Button>
                </Link>
                <Link href="/admin/urunler/yeni">
                  <Button>
                    <Plus size={16} /> İlk Ürününü Ekle
                  </Button>
                </Link>
              </div>
            }
          />
        </div>
      </div>
    );
  }

  const sortKey: SortKey = sortKeys.includes(sort as SortKey) ? (sort as SortKey) : "createdAt";
  const sortDir: "asc" | "desc" = dir === "asc" ? "asc" : "desc";

  const [products, categories] = await Promise.all([
    prisma.product.findMany({
      where: {
        ...(q ? { name: { contains: q, mode: "insensitive" as const } } : {}),
        ...(durum ? { status: durum } : {}),
        ...(kategori ? { categoryId: kategori } : {})
      },
      include: { images: { take: 1, orderBy: { position: "asc" } }, variants: true },
      orderBy:
        sortKey === "name"
          ? { name: sortDir }
          : sortKey === "price"
            ? { priceCents: sortDir }
            : sortKey === "createdAt"
              ? { createdAt: sortDir }
              : { createdAt: "desc" }
    }),
    prisma.category.findMany({ orderBy: { name: "asc" } })
  ]);

  let rows: ProductRow[] = products.map((p) => ({
    id: p.id,
    name: p.name,
    status: p.status,
    priceCents: p.priceCents,
    stock: p.variants.reduce((sum, v) => sum + v.stock, 0),
    createdAt: p.createdAt.toISOString(),
    imageUrl: p.images[0]?.url ?? null
  }));

  if (sortKey === "stock") {
    rows = rows.sort((a, b) => (sortDir === "asc" ? a.stock - b.stock : b.stock - a.stock));
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-admin-text">Ürünler</h1>
        <div className="flex items-center gap-3">
          <Link href="/admin/urunler/excel-yukle">
            <Button variant="secondary">
              <FileSpreadsheet size={16} /> Excel'den Yükle
            </Button>
          </Link>
          <Link href="/admin/urunler/yeni">
            <Button>
              <Plus size={16} /> Yeni Ürün
            </Button>
          </Link>
        </div>
      </div>

      <div className="mt-6">
        <ProductsFilters categories={categories} />
      </div>

      <div className="mt-4">
        <ProductsTable products={rows} initialSort={{ key: sortKey, direction: sortDir }} />
      </div>
    </div>
  );
}
