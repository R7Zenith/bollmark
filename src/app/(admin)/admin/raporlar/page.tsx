import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-admin";
import { Card } from "@/components/admin/card";
import { RaporlarFilters } from "@/components/admin/raporlar-filters";
import { TopProductsChart } from "@/components/admin/top-products-chart";
import { TopProductsTable, type TopProductRow } from "@/components/admin/top-products-table";
import { BreakdownTable, type BreakdownRow } from "@/components/admin/breakdown-table";
import { REVENUE_STATUSES } from "@/lib/orders";

const ALLOWED_DAYS = [7, 30, 90];

export default async function RaporlarPage({
  searchParams
}: {
  searchParams: Promise<{ gun?: string }>;
}) {
  await requireAdmin();
  const { gun } = await searchParams;
  const days = ALLOWED_DAYS.includes(Number(gun)) ? Number(gun) : 30;
  const since = new Date();
  since.setDate(since.getDate() - days);

  const grouped = await prisma.orderItem.groupBy({
    by: ["productId"],
    where: { order: { status: { in: REVENUE_STATUSES }, createdAt: { gte: since } } },
    _sum: { quantity: true, totalCents: true }
  });

  const productIds = grouped.map((g) => g.productId);
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: {
      id: true,
      name: true,
      costCents: true,
      category: { select: { id: true, name: true } },
      brand: { select: { id: true, name: true } }
    }
  });
  const productMap = new Map(products.map((p) => [p.id, p]));

  const topProducts: TopProductRow[] = [...grouped]
    .sort((a, b) => (b._sum.quantity ?? 0) - (a._sum.quantity ?? 0))
    .slice(0, 10)
    .map((g) => {
      const product = productMap.get(g.productId);
      const quantity = g._sum.quantity ?? 0;
      const revenueCents = g._sum.totalCents ?? 0;
      const marginPercent =
        product?.costCents != null && revenueCents > 0
          ? Math.round(((revenueCents - product.costCents * quantity) / revenueCents) * 100)
          : null;
      return {
        productId: g.productId,
        name: product?.name ?? "Silinmiş ürün",
        quantity,
        revenueCents,
        marginPercent
      };
    });
  const missingCostCount = topProducts.filter((p) => p.marginPercent === null).length;

  // Kategori/marka kirilimi tum siparis kalemleri uzerinden - Prisma bu
  // ilişkiyi tek sorguda gruplayamadigi icin (Product uzerinden dolayli),
  // once urun bazli gruplanan veri uygulamada kategori/markaya toplanir.
  const categoryTotals = new Map<string, BreakdownRow>();
  const brandTotals = new Map<string, BreakdownRow>();
  for (const g of grouped) {
    const product = productMap.get(g.productId);
    const quantity = g._sum.quantity ?? 0;
    const revenueCents = g._sum.totalCents ?? 0;

    const catKey = product?.category?.id ?? "yok";
    const catEntry = categoryTotals.get(catKey) ?? {
      key: catKey,
      name: product?.category?.name ?? "Kategorisiz",
      quantity: 0,
      revenueCents: 0
    };
    catEntry.quantity += quantity;
    catEntry.revenueCents += revenueCents;
    categoryTotals.set(catKey, catEntry);

    const brandKey = product?.brand?.id ?? "yok";
    const brandEntry = brandTotals.get(brandKey) ?? {
      key: brandKey,
      name: product?.brand?.name ?? "Markasız",
      quantity: 0,
      revenueCents: 0
    };
    brandEntry.quantity += quantity;
    brandEntry.revenueCents += revenueCents;
    brandTotals.set(brandKey, brandEntry);
  }
  const categoryRows = [...categoryTotals.values()].sort((a, b) => b.revenueCents - a.revenueCents);
  const brandRows = [...brandTotals.values()].sort((a, b) => b.revenueCents - a.revenueCents);

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-admin-text">Raporlar</h1>
        <RaporlarFilters />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title="En Çok Satan Ürünler">
          <TopProductsTable products={topProducts} />
          {missingCostCount > 0 && (
            <p className="mt-3 text-xs text-admin-text-muted">
              {missingCostCount} üründe maliyet girilmemiş, kâr marjı hesaplamasına dahil edilmedi.
            </p>
          )}
        </Card>

        <Card title="Ciro Dağılımı">
          {topProducts.length === 0 ? (
            <p className="text-sm text-admin-text-muted">Bu dönemde grafiklenecek satış yok.</p>
          ) : (
            <TopProductsChart data={topProducts.map((p) => ({ name: p.name, revenueCents: p.revenueCents }))} />
          )}
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title="Kategori Kırılımı">
          <BreakdownTable rows={categoryRows} />
        </Card>

        <Card title="Marka Kırılımı">
          <BreakdownTable rows={brandRows} />
        </Card>
      </div>
    </div>
  );
}
