import Link from "next/link";
import { ArrowLeft, Archive } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-admin";
import { variantOptionsInclude } from "@/lib/variant-attributes";
import { EmptyState } from "@/components/admin/empty-state";
import { ProductsTable, type ProductRow } from "@/components/admin/products-table";
import { SearchInput } from "@/components/admin/search-input";

export default async function ArchivedProductsPage({
  searchParams
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireAdmin();
  const { q } = await searchParams;

  const totalArchived = await prisma.product.count({ where: { status: "ARCHIVED" } });

  if (totalArchived === 0) {
    return (
      <div>
        <BackLink />
        <h1 className="mt-2 text-2xl font-semibold text-admin-text">Arşiv</h1>
        <div className="mt-8 rounded-lg border border-admin-border bg-admin-surface">
          <EmptyState icon={Archive} title="Arşivlenmiş ürün yok" description="Bir ürünü arşivlediğinde burada listelenecek." />
        </div>
      </div>
    );
  }

  const products = await prisma.product.findMany({
    where: {
      status: "ARCHIVED",
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" as const } },
              { code: { contains: q, mode: "insensitive" as const } }
            ]
          }
        : {})
    },
    include: {
      images: { take: 1, orderBy: { position: "asc" } },
      optionImages: { take: 1, orderBy: { position: "asc" } },
      variants: { include: variantOptionsInclude }
    },
    orderBy: { updatedAt: "desc" }
  });

  const rows: ProductRow[] = products.map((p) => {
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
      status: p.status,
      priceCents: p.priceCents,
      stock: p.variants.reduce((sum, v) => sum + v.stock, 0),
      createdAt: p.createdAt.toISOString(),
      imageUrl: p.images[0]?.url ?? p.optionImages[0]?.url ?? null,
      colors: Array.from(colorSet)
    };
  });

  return (
    <div>
      <BackLink />
      <h1 className="mt-2 text-2xl font-semibold text-admin-text">Arşiv</h1>

      <div className="mt-6">
        <ArchiveSearch initialQuery={q ?? ""} />
      </div>

      <div className="mt-4">
        <ProductsTable products={rows} />
      </div>
    </div>
  );
}

function BackLink() {
  return (
    <Link href="/admin/urunler" className="inline-flex items-center gap-1 text-sm text-admin-text-muted hover:text-admin-text">
      <ArrowLeft size={14} /> Ürünlere dön
    </Link>
  );
}

function ArchiveSearch({ initialQuery }: { initialQuery: string }) {
  return (
    <form action="/admin/urunler/arsiv" className="flex">
      <SearchInput name="q" defaultValue={initialQuery} placeholder="Ürün adı veya kodu ile ara..." className="w-64" />
    </form>
  );
}
