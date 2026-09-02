import { Users } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-admin";
import { EmptyState } from "@/components/admin/empty-state";
import { CustomersFilters } from "@/components/admin/customers-filters";
import { CustomersTable, type CustomerRow } from "@/components/admin/customers-table";

interface CustomerAggregate {
  email: string;
  name: string;
  orderCount: number;
  totalSpentCents: number;
  lastOrderAt: Date;
  id: string | null;
  hasAccount: boolean;
  loyaltyPoints: number | null;
}

export default async function AdminCustomersPage({
  searchParams
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireAdmin();
  const { q } = await searchParams;

  // V1'de siparislerden turetilen liste, C.1'den itibaren gercek Customer
  // tablosuyla birlestirilir: her siparis (hesapli veya misafir) yine
  // customerEmail uzerinden gruplanir, hesabi olanlar Customer tablosundan
  // gelen puan bakiyesi ve "Hesapli" rozetiyle zenginlestirilir. Henuz hic
  // siparis vermemis yeni hesaplar da (orderCount: 0) listeye eklenir.
  const [orders, customers] = await Promise.all([
    prisma.order.findMany({
      select: { customerEmail: true, customerName: true, totalCents: true, createdAt: true }
    }),
    prisma.customer.findMany({
      select: { id: true, email: true, name: true, loyaltyPoints: true, createdAt: true }
    })
  ]);

  if (orders.length === 0 && customers.length === 0) {
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
        lastOrderAt: order.createdAt,
        id: null,
        hasAccount: false,
        loyaltyPoints: null
      });
    }
  }

  for (const customer of customers) {
    const existing = byEmail.get(customer.email);
    if (existing) {
      existing.id = customer.id;
      existing.hasAccount = true;
      existing.loyaltyPoints = customer.loyaltyPoints;
    } else {
      byEmail.set(customer.email, {
        email: customer.email,
        name: customer.name,
        orderCount: 0,
        totalSpentCents: 0,
        lastOrderAt: customer.createdAt,
        id: customer.id,
        hasAccount: true,
        loyaltyPoints: customer.loyaltyPoints
      });
    }
  }

  let allCustomers = Array.from(byEmail.values()).sort((a, b) => b.lastOrderAt.getTime() - a.lastOrderAt.getTime());

  if (q) {
    const needle = q.toLowerCase();
    allCustomers = allCustomers.filter(
      (c) => c.name.toLowerCase().includes(needle) || c.email.toLowerCase().includes(needle)
    );
  }

  const rows: CustomerRow[] = allCustomers.map((c) => ({ ...c, lastOrderAt: c.lastOrderAt.toISOString() }));

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
