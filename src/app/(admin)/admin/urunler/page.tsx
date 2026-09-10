import Link from "next/link";
import { Plus, Package, FileSpreadsheet, ImageOff, Archive } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-admin";
import { variantOptionsInclude } from "@/lib/variant-attributes";
import { Button } from "@/components/admin/button";
import { EmptyState } from "@/components/admin/empty-state";
import { ProductsFilters } from "@/components/admin/products-filters";
import { ProductsTable, type ProductRow } from "@/components/admin/products-table";

type SortKey = "name" | "price" | "stock" | "createdAt" | "photo";
const sortKeys: SortKey[] = ["name", "price", "stock", "createdAt", "photo"];

interface SearchParams {
  q?: string;
  durum?: string;
  kategori?: string;
  fotograf?: string;
  sort?: string;
  dir?: string;
}

export default async function AdminProductsPage({
  searchParams
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireAdmin();
  const { q, durum, kategori, fotograf, sort, dir } = await searchParams;

  // Arsivlenmis urunler bu listede yer kaplamasin diye varsayilan olarak
  // haric tutuluyor - kendi ayri sayfasinda (/admin/urunler/arsiv) duruyorlar.
  const totalCount = await prisma.product.count({ where: { status: { not: "ARCHIVED" } } });
  const archivedCount = await prisma.product.count({ where: { status: "ARCHIVED" } });
  const missingPhotoCount = await prisma.product.count({
    where: { status: { not: "ARCHIVED" }, images: { none: {} }, optionImages: { none: {} } }
  });

  if (totalCount === 0) {
    return (
      <div>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-admin-text">Ürünler</h1>
          {archivedCount > 0 && (
            <Link href="/admin/urunler/arsiv">
              <Button variant="secondary" size="sm-md">
                <Archive size={16} /> Arşiv ({archivedCount})
              </Button>
            </Link>
          )}
        </div>
        <div className="mt-8 rounded-lg border border-admin-border bg-admin-surface">
          <EmptyState
            icon={Package}
            title="Henüz ürün yok"
            description="Mağazana ilk ürününü ekleyerek başla."
            action={
              <div className="flex items-center gap-2 md:gap-3">
                <Link href="/admin/urunler/excel-yukle">
                  <Button variant="secondary" size="sm-md">
                    <FileSpreadsheet size={16} /> Excel'den Yükle
                  </Button>
                </Link>
                <Link href="/admin/urunler/yeni">
                  <Button size="sm-md">
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
        status: { not: "ARCHIVED" },
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: "insensitive" as const } },
                { code: { contains: q, mode: "insensitive" as const } }
              ]
            }
          : {}),
        ...(durum ? { status: durum } : {}),
        ...(kategori ? { categoryId: kategori } : {}),
        ...(fotograf === "yok" ? { images: { none: {} }, optionImages: { none: {} } } : {})
      },
      include: {
        images: { take: 1, orderBy: { position: "asc" } },
        optionImages: { take: 1, orderBy: { position: "asc" } },
        // Renk (isColor:true) varyant secenegini okuyabilmek icin secenek
        // degerleriyle birlikte cekiliyor - listede "Renkler" kolonu icin.
        variants: { include: variantOptionsInclude }
      },
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

  let rows: ProductRow[] = products.map((p) => {
    // Bu urunun varyantlarinda gercekten var olan renkler (Renk ekseni,
    // isColor:true) - birden fazlaysa listede "Renkler" kolonunda gosterilir.
    const colorSet = new Set<string>();
    for (const v of p.variants) {
      for (const o of v.options) {
        if (o.value.attribute.isColor) colorSet.add(o.value.value);
      }
    }
    return {
      id: p.id,
      name: p.name,
      code: p.code,
      slug: p.slug,
      status: p.status,
      priceCents: p.priceCents,
      stock: p.variants.reduce((sum, v) => sum + v.stock, 0),
      createdAt: p.createdAt.toISOString(),
      imageUrl: p.images[0]?.url ?? p.optionImages[0]?.url ?? null,
      colors: Array.from(colorSet)
    };
  });

  if (sortKey === "stock") {
    rows = rows.sort((a, b) => (sortDir === "asc" ? a.stock - b.stock : b.stock - a.stock));
  } else if (sortKey === "photo") {
    rows = rows.sort((a, b) => {
      const aMissing = a.imageUrl ? 0 : 1;
      const bMissing = b.imageUrl ? 0 : 1;
      return sortDir === "asc" ? bMissing - aMissing : aMissing - bMissing;
    });
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-admin-text">Ürünler</h1>
        <div className="flex items-center gap-2 md:gap-3">
          {archivedCount > 0 && (
            <Link href="/admin/urunler/arsiv">
              <Button variant="secondary" size="sm-md">
                <Archive size={16} /> Arşiv ({archivedCount})
              </Button>
            </Link>
          )}
          <Link href="/admin/urunler/excel-yukle">
            <Button variant="secondary" size="sm-md">
              <FileSpreadsheet size={16} /> Excel'den Yükle
            </Button>
          </Link>
          <Link href="/admin/urunler/yeni">
            <Button size="sm-md">
              <Plus size={16} /> Yeni Ürün
            </Button>
          </Link>
        </div>
      </div>

      {missingPhotoCount > 0 && (
        <Link
          href="/admin/urunler?fotograf=yok"
          className="mt-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 hover:bg-red-100"
        >
          <ImageOff size={16} className="flex-shrink-0" />
          <span>
            <strong>{missingPhotoCount}</strong> ürün fotoğrafsız, incele
          </span>
        </Link>
      )}

      <div className="mt-6">
        <ProductsFilters categories={categories} />
      </div>

      <div className="mt-4">
        <ProductsTable products={rows} initialSort={{ key: sortKey, direction: sortDir }} />
      </div>
    </div>
  );
}
