import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/format";

const statusLabel: Record<string, string> = {
  DRAFT: "Taslak",
  PUBLISHED: "Yayinda",
  ARCHIVED: "Arsiv"
};

export default async function AdminProductsPage() {
  const products = await prisma.product.findMany({
    include: { images: { take: 1 }, variants: true },
    orderBy: { createdAt: "desc" }
  });

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-admin-text">Urunler</h1>
        <Link
          href="/admin/urunler/yeni"
          className="rounded-md bg-admin-accent px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          + Yeni Urun
        </Link>
      </div>

      <table className="mt-8 w-full border-collapse overflow-hidden rounded-lg bg-admin-surface text-sm">
        <thead>
          <tr className="border-b border-admin-border text-left text-xs uppercase tracking-wide text-admin-text-muted">
            <th className="px-4 py-3">Urun</th>
            <th className="px-4 py-3">Durum</th>
            <th className="px-4 py-3">Fiyat</th>
            <th className="px-4 py-3">Stok</th>
            <th className="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody>
          {products.map((p) => {
            const stock = p.variants.reduce((sum, v) => sum + v.stock, 0);
            return (
              <tr key={p.id} className="border-b border-admin-border text-admin-text">
                <td className="px-4 py-3">{p.name}</td>
                <td className="px-4 py-3">{statusLabel[p.status]}</td>
                <td className="px-4 py-3">{formatPrice(p.priceCents)}</td>
                <td className="px-4 py-3">{stock}</td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/admin/urunler/${p.id}`} className="text-admin-accent hover:underline">
                    Duzenle
                  </Link>
                </td>
              </tr>
            );
          })}
          {products.length === 0 && (
            <tr>
              <td colSpan={5} className="px-4 py-8 text-center text-admin-text-muted">
                Henuz urun eklenmedi.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
