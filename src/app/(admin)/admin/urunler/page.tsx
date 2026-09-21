import Link from "next/link";
import { Plus, Package, FileSpreadsheet, ImageOff, Archive } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-admin";
import { variantOptionsInclude } from "@/lib/variant-attributes";
import { Button } from "@/components/admin/button";
import { EmptyState } from "@/components/admin/empty-state";
import { ProductsFilters } from "@/components/admin/products-filters";
import { ProductsPagination } from "@/components/admin/products-pagination";
import { ProductsTable, type ProductRow } from "@/components/admin/products-table";

type SortKey = "name" | "price" | "stock" | "createdAt" | "photo";
const sortKeys: SortKey[] = ["name", "price", "stock", "createdAt", "photo"];
const pageSizes: readonly number[] = [10, 25, 50, 100];
const defaultPageSize = 25;

interface SearchParams {
  sayfa?: string;
  adet?: string;
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
  const { q, durum, kategori, fotograf, sort, dir, sayfa, adet } = await searchParams;

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
                    <FileSpreadsheet size={16} /> Excel&apos;den Yükle
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

  const where = {
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
  };

  const pageSize = pageSizes.includes(Number(adet)) ? Number(adet) : defaultPageSize;
  const filteredCount = await prisma.product.count({ where });
  const totalPages = Math.max(1, Math.ceil(filteredCount / pageSize));
  const currentPage = Math.min(Math.max(parseInt(sayfa ?? "", 10) || 1, 1), totalPages);
  const skip = (currentPage - 1) * pageSize;

  const include = {
    images: { take: 1, orderBy: { position: "asc" } },
    // Renk bazinda "bu rengin hic gorseli var mi" hesabi icin (missingColorCount)
    // sadece ilk kaydi degil, hepsini valueId ile birlikte cekmemiz gerekiyor -
    // urun genelinde tek bir optionImages[0] varligina bakmak, cok renkli bir
    // urunde sadece 1 rengin gorseli olsa bile diger renkleri gizliyordu.
    optionImages: { select: { url: true, valueId: true }, orderBy: { position: "asc" } },
    // Renk (isColor:true) varyant secenegini okuyabilmek icin secenek
    // degerleriyle birlikte cekiliyor - listede "Renkler" kolonu icin.
    variants: { include: variantOptionsInclude }
  } as const;

  // Ikinci anahtar { id: "asc" }: Excel'den toplu eklenen urunlerde createdAt ayni
  // olabiliyor, siralama kararli olmazsa sayfalar arasinda urun tekrar eder/atlanir.
  async function fetchPage() {
    if (sortKey === "stock" || sortKey === "photo") {
      // Stok ve fotograf siralamasi veritabaninda yapilamiyor; tum eslesenler icin
      // hafif bir sorgu ile bellekte siralayip sadece sayfanin urunlerini tam cekiyoruz.
      const light = await prisma.product.findMany({
        where,
        select: {
          id: true,
          variants: { select: { stock: true } },
          images: { take: 1, select: { id: true } },
          optionImages: { take: 1, select: { id: true } }
        },
        orderBy: [{ createdAt: "desc" }, { id: "asc" }]
      });
      const keyed = light.map((p) => ({
        id: p.id,
        stock: p.variants.reduce((sum, v) => sum + v.stock, 0),
        missingPhoto: p.images.length === 0 && p.optionImages.length === 0 ? 1 : 0
      }));
      keyed.sort((a, b) =>
        sortKey === "stock"
          ? sortDir === "asc"
            ? a.stock - b.stock
            : b.stock - a.stock
          : sortDir === "asc"
            ? b.missingPhoto - a.missingPhoto
            : a.missingPhoto - b.missingPhoto
      );
      const ids = keyed.slice(skip, skip + pageSize).map((p) => p.id);
      const full = await prisma.product.findMany({ where: { id: { in: ids } }, include });
      const byId = new Map(full.map((p) => [p.id, p]));
      return ids.map((id) => byId.get(id)!);
    }
    const field = sortKey === "price" ? "priceCents" : sortKey;
    return prisma.product.findMany({
      where,
      include,
      orderBy: [{ [field]: sortDir }, { id: "asc" }],
      skip,
      take: pageSize
    });
  }

  const [products, categories] = await Promise.all([fetchPage(), prisma.category.findMany({ orderBy: { name: "asc" } })]);

  const rows: ProductRow[] = products.map((p) => {
    // Bu urunun varyantlarinda gercekten var olan renkler (Renk ekseni,
    // isColor:true) - birden fazlaysa listede "Renkler" kolonunda gosterilir.
    const colorValueIds = new Set<string>();
    const colorSet = new Set<string>();
    for (const v of p.variants) {
      for (const o of v.options) {
        if (o.value.attribute.isColor) {
          colorValueIds.add(o.valueId);
          colorSet.add(o.value.value);
        }
      }
    }
    // Renk bazinda "hic gorseli olmayan renk sayisi" - optionImages tablosunda
    // o valueId icin hic kayit yoksa o renk fotografsiz sayilir. Tek renkli
    // urunlerde (colorValueIds bos) bu sayim anlamsiz, hep 0 kalir.
    const valueIdsWithImage = new Set(p.optionImages.map((img) => img.valueId));
    const missingColorCount = Array.from(colorValueIds).filter((id) => !valueIdsWithImage.has(id)).length;
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
      colors: Array.from(colorSet),
      missingColorCount
    };
  });

  const pagination = (
    <ProductsPagination page={currentPage} pageSize={pageSize} pageSizes={pageSizes} total={filteredCount} />
  );

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
              <FileSpreadsheet size={16} /> Excel&apos;den Yükle
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

      <div className="mt-4 space-y-3">
        {filteredCount > 0 && pagination}
        {/* key: sayfa/adet degisince secili satirlar sifirlansin, gorunmeyen urunler toplu islemde kalmasin */}
        <ProductsTable
          key={`${currentPage}-${pageSize}`}
          products={rows}
          initialSort={{ key: sortKey, direction: sortDir }}
        />
        {filteredCount > 0 && pagination}
      </div>
    </div>
  );
}
