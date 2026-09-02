import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/format";
import { returnStatuses } from "@/lib/status";

const schema = z.object({
  orderNumber: z.string().min(1),
  email: z.string().email()
});

interface ReturnItemSnapshot {
  orderItemId: string;
  quantity: number;
}

function parseItemsJson(raw: string): ReturnItemSnapshot[] {
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((v): v is Record<string, unknown> => typeof v === "object" && v !== null)
      .map((v) => ({ orderItemId: String(v.orderItemId ?? ""), quantity: Number(v.quantity) || 0 }))
      .filter((v) => v.orderItemId);
  } catch {
    return [];
  }
}

// Musteri hesabi olmadigi icin siparis, numarasi + e-posta esleşmesiyle
// dogrulanir. Ikisi de eslesmezse "bulunamadi" doner - siparis var ama
// e-posta yanlis gibi bir bilgi sizdirmaz (ayni prensip iade-talebi'nde de).
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Sipariş numarası ve e-posta adresi gerekli." }, { status: 400 });
  }

  const order = await prisma.order.findFirst({
    where: {
      orderNumber: parsed.data.orderNumber.trim(),
      customerEmail: { equals: parsed.data.email.trim(), mode: "insensitive" }
    },
    include: {
      items: { include: { product: { select: { name: true } } } },
      shipment: true,
      returnRequests: { orderBy: { createdAt: "desc" } }
    }
  });

  if (!order) {
    return NextResponse.json(
      { error: "Sipariş bulunamadı. Sipariş numarasını ve e-posta adresini kontrol edin." },
      { status: 404 }
    );
  }

  // Ayni urun icin acik (terminal olmayan) bir talep varsa musteri yeni
  // talep formunda o urunu tekrar secemesin diye burada isaretleniyor.
  const openItemIds = new Set<string>();
  for (const rr of order.returnRequests) {
    if (rr.status === "TAMAMLANDI" || rr.status === "REDDEDILDI") continue;
    for (const item of parseItemsJson(rr.itemsJson)) openItemIds.add(item.orderItemId);
  }

  return NextResponse.json({
    order: {
      orderNumber: order.orderNumber,
      status: order.status,
      createdAt: order.createdAt,
      totalCents: order.totalCents,
      totalLabel: formatPrice(order.totalCents),
      shipment: order.shipment
        ? { carrier: order.shipment.carrier, trackingCode: order.shipment.trackingCode, status: order.shipment.status }
        : null,
      items: order.items.map((item) => ({
        id: item.id,
        productName: item.product.name,
        quantity: item.quantity,
        totalCents: item.totalCents,
        totalLabel: formatPrice(item.totalCents),
        hasOpenReturn: openItemIds.has(item.id)
      }))
    },
    eligibleForReturn: order.status === "DELIVERED",
    returnRequests: order.returnRequests.map((rr) => ({
      id: rr.id,
      type: rr.type,
      reason: rr.reason,
      status: returnStatuses.includes(rr.status as (typeof returnStatuses)[number])
        ? rr.status
        : "TALEP_EDILDI",
      createdAt: rr.createdAt,
      customerNote: rr.customerNote,
      adminNote: rr.adminNote,
      items: parseItemsJson(rr.itemsJson)
    }))
  });
}
