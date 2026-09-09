// Siparişler sayfası (liste, sekme rozetleri, CSV dışa aktarma) ile paylaşılan
// filtre mantığı - tekrarı önlemek için tek yerde tutuluyor.
import type { Prisma } from "@/generated/prisma/client";
import type { DateRange } from "@/lib/order-period";

export type OrderTabKey = "tumu" | "odenmedi" | "acik" | "kapatildi";

export const orderTabs: { value: OrderTabKey; label: string }[] = [
  { value: "tumu", label: "Tümü" },
  { value: "odenmedi", label: "Ödenmedi" },
  { value: "acik", label: "Açık" },
  { value: "kapatildi", label: "Kapatıldı" }
];

export const tabStatusMap: Record<Exclude<OrderTabKey, "tumu">, string[]> = {
  odenmedi: ["PENDING_PAYMENT"],
  acik: ["PAID", "PREPARING", "SHIPPED"],
  kapatildi: ["DELIVERED", "CANCELLED", "REFUNDED"]
};

export function resolveTab(sekme: string | undefined): OrderTabKey {
  return sekme === "odenmedi" || sekme === "acik" || sekme === "kapatildi" ? sekme : "tumu";
}

export function broadTabForStatus(status: string): Exclude<OrderTabKey, "tumu"> | null {
  for (const [tab, statuses] of Object.entries(tabStatusMap)) {
    if (statuses.includes(status)) return tab as Exclude<OrderTabKey, "tumu">;
  }
  return null;
}

export interface OrderFilterParams {
  q?: string;
  durum?: string;
  kargoDurum?: string;
  dateRange?: DateRange;
  sekme?: OrderTabKey;
}

export function buildOrdersWhere({ q, durum, kargoDurum, dateRange, sekme }: OrderFilterParams): Prisma.OrderWhereInput {
  const statusConditions: Prisma.OrderWhereInput[] = [];
  if (durum) statusConditions.push({ status: durum });
  if (sekme && sekme !== "tumu") statusConditions.push({ status: { in: tabStatusMap[sekme] } });

  return {
    deletedAt: null,
    ...(q
      ? {
          OR: [
            { orderNumber: { contains: q, mode: "insensitive" as const } },
            { customerName: { contains: q, mode: "insensitive" as const } },
            { customerEmail: { contains: q, mode: "insensitive" as const } }
          ]
        }
      : {}),
    ...(statusConditions.length ? { AND: statusConditions } : {}),
    ...(kargoDurum === "YOK" ? { shipment: null } : kargoDurum ? { shipment: { status: kargoDurum } } : {}),
    ...(dateRange?.start || dateRange?.end
      ? { createdAt: { gte: dateRange.start, lte: dateRange.end } }
      : {})
  };
}
