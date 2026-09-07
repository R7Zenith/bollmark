import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/format";
import { orderStatusLabel, shipmentStatusLabel } from "@/lib/status";
import { buildOrdersWhere, resolveTab } from "@/lib/order-query";
import { resolvePeriodRange } from "@/lib/order-period";

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Yetkisiz istek." }, { status: 401 });
  }

  const params = request.nextUrl.searchParams;
  const q = params.get("q") ?? undefined;
  const durum = params.get("durum") ?? undefined;
  const kargoDurum = params.get("kargoDurum") ?? undefined;
  const donem = params.get("donem") ?? undefined;
  const baslangic = params.get("baslangic") ?? undefined;
  const bitis = params.get("bitis") ?? undefined;
  const sekme = resolveTab(params.get("sekme") ?? undefined);

  const { current } = resolvePeriodRange(donem, baslangic, bitis);
  const where = buildOrdersWhere({ q, durum, kargoDurum, dateRange: current, sekme });

  const orders = await prisma.order.findMany({
    where,
    include: { shipment: true },
    orderBy: { createdAt: "desc" }
  });

  const header = ["Sipariş No", "Müşteri Adı", "E-posta", "Ödeme Durumu", "Kargo Durumu", "Tutar", "Tarih"];
  const lines = [header.map(csvEscape).join(",")];

  for (const order of orders) {
    const kargoDurumLabel = order.shipment
      ? (shipmentStatusLabel[order.shipment.status as keyof typeof shipmentStatusLabel] ?? order.shipment.status)
      : "Kargo Yok";
    const row = [
      order.orderNumber,
      order.customerName,
      order.customerEmail,
      orderStatusLabel[order.status as keyof typeof orderStatusLabel] ?? order.status,
      kargoDurumLabel,
      formatPrice(order.totalCents),
      order.createdAt.toLocaleDateString("tr-TR")
    ];
    lines.push(row.map((v) => csvEscape(String(v))).join(","));
  }

  const csv = "﻿" + lines.join("\r\n");

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="siparisler.csv"`
    }
  });
}
