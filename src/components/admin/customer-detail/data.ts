import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

// Hesapli ve misafir musteri detayinin ortak verisi. Siparis kumesi musteri
// listesiyle (admin/musteriler/page.tsx) ayni kural: deletedAt null olan her
// siparis, toplam = totalCents toplami (durum/odeme filtresi yok).
export const customerOrderSelect = {
  id: true,
  orderNumber: true,
  createdAt: true,
  status: true,
  paymentStatus: true,
  totalCents: true,
  customerName: true,
  customerPhone: true,
  shippingAddress: true,
  district: true,
  city: true,
  postalCode: true,
  clientIp: true,
  ipCity: true,
  ipRegion: true,
  ipCountry: true
} satisfies Prisma.OrderSelect;

export type CustomerOrder = Prisma.OrderGetPayload<{ select: typeof customerOrderSelect }>;

export function loadCustomerOrders(where: Prisma.OrderWhereInput) {
  return prisma.order.findMany({
    where: { deletedAt: null, ...where },
    select: customerOrderSelect,
    orderBy: { createdAt: "desc" }
  });
}

export interface OrderSummary {
  orderCount: number;
  totalSpentCents: number;
  lastOrderAt: Date | null;
}

export function summarizeOrders(orders: { totalCents: number; createdAt: Date }[]): OrderSummary {
  let totalSpentCents = 0;
  let lastOrderAt: Date | null = null;
  for (const order of orders) {
    totalSpentCents += order.totalCents;
    if (!lastOrderAt || order.createdAt > lastOrderAt) lastOrderAt = order.createdAt;
  }
  return { orderCount: orders.length, totalSpentCents, lastOrderAt };
}

export interface AddressParts {
  address: string;
  district: string;
  city: string;
  postalCode: string | null;
}

// Birebir karsilastirma: bosluk ve harf buyuklugu farki ayni adres sayilir.
export function addressKey(a: AddressParts): string {
  return [a.address, a.district, a.city, a.postalCode ?? ""].map((v) => v.trim().replace(/\s+/g, " ").toLocaleLowerCase("tr")).join("|");
}

export interface OrderAddress extends AddressParts {
  key: string;
  orderCount: number;
  lastUsedAt: Date;
}

// Siparislerdeki teslimat adreslerinin tekrarsiz listesi; kayitli adreslerle
// birebir ayni olanlar atlanir. orders en yeni ustte gelir.
export function orderAddresses(orders: CustomerOrder[], saved: AddressParts[] = []): OrderAddress[] {
  const savedKeys = new Set(saved.map(addressKey));
  const byKey = new Map<string, OrderAddress>();
  for (const order of orders) {
    const parts = { address: order.shippingAddress, district: order.district, city: order.city, postalCode: order.postalCode };
    const key = addressKey(parts);
    if (savedKeys.has(key)) continue;
    const existing = byKey.get(key);
    if (existing) existing.orderCount += 1;
    else byKey.set(key, { ...parts, key, orderCount: 1, lastUsedAt: order.createdAt });
  }
  return [...byKey.values()];
}

export type IpEventType = "ORDER" | "LOGIN" | "SIGNUP";

export interface IpEvent {
  type: IpEventType;
  ip: string;
  city: string | null;
  region: string | null;
  country: string | null;
  at: Date;
}

export function orderIpEvents(orders: CustomerOrder[]): IpEvent[] {
  return orders.flatMap((o) =>
    o.clientIp ? [{ type: "ORDER" as const, ip: o.clientIp, city: o.ipCity, region: o.ipRegion, country: o.ipCountry, at: o.createdAt }] : []
  );
}

export async function deviceIpEvents(customerId: string): Promise<IpEvent[]> {
  const devices = await prisma.customerDevice.findMany({
    where: { customerId, ip: { not: null } },
    select: { ip: true, ipCity: true, ipRegion: true, ipCountry: true, event: true, createdAt: true },
    orderBy: { createdAt: "desc" }
  });
  return devices.map((d) => ({
    type: d.event === "SIGNUP" ? "SIGNUP" : "LOGIN",
    ip: d.ip!,
    city: d.ipCity,
    region: d.ipRegion,
    country: d.ipCountry,
    at: d.createdAt
  }));
}

// Bos durum metni icin: sistemdeki en eski IP kaydi (siparis ya da cihaz).
export async function ipTrackingStart(): Promise<Date | null> {
  const [order, device] = await Promise.all([
    prisma.order.findFirst({ where: { clientIp: { not: null } }, orderBy: { createdAt: "asc" }, select: { createdAt: true } }),
    prisma.customerDevice.findFirst({ where: { ip: { not: null } }, orderBy: { createdAt: "asc" }, select: { createdAt: true } })
  ]);
  const dates = [order?.createdAt, device?.createdAt].filter((d): d is Date => Boolean(d));
  return dates.length ? new Date(Math.min(...dates.map((d) => d.getTime()))) : null;
}
