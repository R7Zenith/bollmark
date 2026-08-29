import { Users } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { EmptyState } from "@/components/admin/empty-state";
import { CustomersFilters } from "@/components/admin/customers-filters";
import { CustomersTable, type CustomerRow } from "@/components/admin/customers-table";

interface CustomerAggregate {
  email: string;
  name: string;
  orderCount: number;
  totalSpentCents: number;
  lastOrderAt: Date;
}

export default async function AdminCustomersPage({
  searchParams
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;

  const orders = await prisma.order.findMany({
    select: { customerEmail: true, customerName: true, totalCents: true, createdAt: true },
    orderBy: { createdAt: "desc" }
  });

  if (orders.length === 0) {
    return (
      <div>
        <h1 className="text-2xl font-semibold text-admin-text">Müşteriler</h1>
        <div className="mt-8 rounded-lg border border-admin-border bg-admin-surface">
          <EmptyState icon={Users} title="Henüz müşteri yok" description="İlk sipariş geldiğinde müşteriler burada listelenecek." />
        </div>
      </div>
    );
  }

  const byEmail = new Map<string, CustomerAggregate>();
  for (const order of orders) {
    const existing = byEmail.get(order.customerEmail);
    if (existing) {
      existing.orderCount += 1;
      existing.totalSpentCents += order.totalCents;
      if (order.createdAt > existing.lastOrderAt) {
        existing.lastOrderAt = order.createdAt;
        existing.name = order.customerName;
      }
    } else {
      byEmail.set(order.customerEmail, {
        email: order.customerEmail,
        name: order.customerName,
        orderCount: 1,
        totalSpentCents: order.totalCents,
        lastOrderAt: order.createdAt
      });
    }
  }

  let customers = Array.from(byEmail.values()).sort((a, b) => b.lastOrderAt.getTime() - a.lastOrderAt.getTime());

  if (q) {
    const needle = q.toLowerCase();
    customers = customers.filter(
      (c) => c.name.toLowerCase().includes(needle) || c.email.toLowerCase().includes(needle)
    );
  }

  const rows: CustomerRow[] = customers.map((c) => ({ ...c, lastOrderAt: c.lastOrderAt.toISOString() }));

  return (
    <div>
      <h1 className="text-2xl font-semibold text-admin-text">Müşteriler</h1>

      <div className="mt-6">
        <CustomersFilters />
      </div>

      <div className="mt-4">
        <CustomersTable customers={rows} />
      </div>
    </div>
  );
}
