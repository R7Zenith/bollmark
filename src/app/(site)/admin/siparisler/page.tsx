import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/format";

const statusLabel: Record<string, string> = {
  PENDING_PAYMENT: "Odeme Bekliyor",
  PAID: "Odendi",
  PREPARING: "Hazirlaniyor",
  SHIPPED: "Kargolandi",
  DELIVERED: "Teslim Edildi",
  CANCELLED: "Iptal",
  REFUNDED: "Iade Edildi"
};

export default async function AdminOrdersPage() {
  const orders = await prisma.order.findMany({
    orderBy: { createdAt: "desc" },
    include: { items: true }
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold text-admin-text">Siparisler</h1>

      <table className="mt-8 w-full border-collapse overflow-hidden rounded-lg bg-admin-surface text-sm">
        <thead>
          <tr className="border-b border-admin-border text-left text-xs uppercase tracking-wide text-admin-text-muted">
            <th className="px-4 py-3">Siparis No</th>
            <th className="px-4 py-3">Musteri</th>
            <th className="px-4 py-3">Durum</th>
            <th className="px-4 py-3">Tutar</th>
            <th className="px-4 py-3">Tarih</th>
            <th className="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id} className="border-b border-admin-border text-admin-text">
              <td className="px-4 py-3 font-mono">{o.orderNumber}</td>
              <td className="px-4 py-3">{o.customerName}</td>
              <td className="px-4 py-3">{statusLabel[o.status]}</td>
              <td className="px-4 py-3">{formatPrice(o.totalCents)}</td>
              <td className="px-4 py-3">{o.createdAt.toLocaleDateString("tr-TR")}</td>
              <td className="px-4 py-3 text-right">
                <Link href={`/admin/siparisler/${o.id}`} className="text-admin-accent hover:underline">
                  Detay
                </Link>
              </td>
            </tr>
          ))}
          {orders.length === 0 && (
            <tr>
              <td colSpan={6} className="px-4 py-8 text-center text-admin-text-muted">
                Henuz siparis yok.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
