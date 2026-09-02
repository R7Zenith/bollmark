import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { returnTypes } from "@/lib/status";

const itemSchema = z.object({
  orderItemId: z.string().min(1),
  quantity: z.number().int().positive()
});

const schema = z.object({
  orderNumber: z.string().min(1),
  email: z.string().email(),
  type: z.enum(returnTypes),
  reason: z.string().min(1),
  items: z.array(itemSchema).min(1),
  customerNote: z.string().optional()
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

// Musteri hesabi olmadigi icin (bkz. siparis-sorgula/route.ts) talep de
// siparis no + e-posta ile acilir - istemciden gelen orderId'ye guvenilmez,
// esleşme burada sunucuda tekrar dogrulanir (kupon/fiyat hesaplamasindaki
// "istemciden gelen degere guvenme" prensibiyle ayni).
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
  }
  const data = parsed.data;

  const order = await prisma.order.findFirst({
    where: {
      orderNumber: data.orderNumber.trim(),
      customerEmail: { equals: data.email.trim(), mode: "insensitive" }
    },
    include: { items: true, returnRequests: true }
  });
  if (!order) {
    return NextResponse.json(
      { error: "Sipariş bulunamadı. Sipariş numarasını ve e-posta adresini kontrol edin." },
      { status: 404 }
    );
  }

  // Teslim edilmemis bir siparis icin iade anlamsiz - PENDING_PAYMENT/PAID/
  // PREPARING/SHIPPED durumunda zaten ayri bir "Iptal" akisi var.
  if (order.status !== "DELIVERED") {
    return NextResponse.json(
      { error: "Bu sipariş için iade/değişim talebi oluşturulamaz (henüz teslim edilmedi)." },
      { status: 400 }
    );
  }

  const orderItemById = new Map(order.items.map((item) => [item.id, item]));
  for (const line of data.items) {
    const orderItem = orderItemById.get(line.orderItemId);
    if (!orderItem || line.quantity > orderItem.quantity) {
      return NextResponse.json({ error: "Seçilen ürün bu siparişe ait değil." }, { status: 400 });
    }
  }

  const openItemIds = new Set<string>();
  for (const rr of order.returnRequests) {
    if (rr.status === "TAMAMLANDI" || rr.status === "REDDEDILDI") continue;
    for (const item of parseItemsJson(rr.itemsJson)) openItemIds.add(item.orderItemId);
  }
  if (data.items.some((line) => openItemIds.has(line.orderItemId))) {
    return NextResponse.json(
      { error: "Seçilen ürünlerden biri için zaten açık bir talep var." },
      { status: 400 }
    );
  }

  const returnRequest = await prisma.returnRequest.create({
    data: {
      orderId: order.id,
      type: data.type,
      reason: data.reason,
      itemsJson: JSON.stringify(data.items),
      customerNote: data.customerNote?.trim() || null
    }
  });

  return NextResponse.json({ id: returnRequest.id }, { status: 201 });
}
