import { CalendarClock, Receipt, ShoppingBag, Wallet } from "lucide-react";
import { StatCard } from "@/components/admin/stat-card";
import { formatDate, formatPrice } from "@/lib/format";
import type { OrderSummary } from "./data";

export function CustomerSummaryCards({ summary }: { summary: OrderSummary }) {
  const average = summary.orderCount > 0 ? Math.round(summary.totalSpentCents / summary.orderCount) : 0;
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard icon={ShoppingBag} label="Sipariş sayısı" value={summary.orderCount} />
      <StatCard icon={Wallet} label="Toplam harcama" value={formatPrice(summary.totalSpentCents)} />
      <StatCard icon={Receipt} label="Ortalama sepet" value={summary.orderCount > 0 ? formatPrice(average) : "-"} />
      <StatCard icon={CalendarClock} label="Son sipariş" value={summary.lastOrderAt ? formatDate(summary.lastOrderAt) : "-"} />
    </div>
  );
}
