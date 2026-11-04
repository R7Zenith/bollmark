import Link from "next/link";
import { Badge } from "@/components/admin/badge";
import { Card } from "@/components/admin/card";
import { formatDateTime, formatPrice } from "@/lib/format";
import { orderStatusLabel, orderStatusTone, paymentStatusLabel, paymentStatusTone, type OrderStatus } from "@/lib/status";
import type { CustomerOrder } from "./data";

const HISTORY_LIMIT = 50;

export function OrderHistoryCard({ orders, allOrdersHref }: { orders: CustomerOrder[]; allOrdersHref: string }) {
  const shown = orders.slice(0, HISTORY_LIMIT);
  return (
    <Card
      title={`Sipariş geçmişi (${orders.length})`}
      action={
        orders.length > HISTORY_LIMIT && (
          <Link href={allOrdersHref} className="text-sm text-admin-accent hover:underline">
            Tümünü gör
          </Link>
        )
      }
    >
      {shown.length === 0 ? (
        <p className="text-sm text-admin-text-muted">Sipariş yok.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-admin-text-muted">
              <tr>
                <th className="py-2 pr-4">Sipariş</th>
                <th className="py-2 pr-4">Tarih</th>
                <th className="py-2 pr-4">Durum</th>
                <th className="py-2 pr-4">Ödeme</th>
                <th className="py-2 pr-4 text-right">Tutar</th>
                <th className="py-2">İl</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((order) => (
                <tr key={order.id} className="border-t border-admin-border text-admin-text">
                  <td className="whitespace-nowrap py-3 pr-4">
                    <Link href={`/admin/siparisler/${order.id}`} className="font-medium hover:underline">
                      {order.orderNumber}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap py-3 pr-4">{formatDateTime(order.createdAt)}</td>
                  <td className="whitespace-nowrap py-3 pr-4">
                    <Badge tone={orderStatusTone[order.status as OrderStatus]}>
                      {orderStatusLabel[order.status as OrderStatus] ?? order.status}
                    </Badge>
                  </td>
                  <td className="whitespace-nowrap py-3 pr-4">
                    <Badge tone={paymentStatusTone[order.paymentStatus] ?? "gray"}>
                      {paymentStatusLabel[order.paymentStatus] ?? order.paymentStatus}
                    </Badge>
                  </td>
                  <td className="whitespace-nowrap py-3 pr-4 text-right">{formatPrice(order.totalCents)}</td>
                  <td className="whitespace-nowrap py-3">{order.city}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
