import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit-log";

const schema = z.object({
  customerId: z.string().min(1),
  points: z.number().int().refine((v) => v !== 0, "Puan sıfır olamaz."),
  note: z.string().optional()
});

// Admin panelden elle puan duzeltmesi - siparis kaynakli otomatik
// kazanc/kullanimdan (lib/loyalty.ts) ayri, LoyaltyTransaction'a
// "ADMIN_DUZELTME" olarak islenir ve denetim kaydina yazilir.
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Yetkisiz istek." }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
  }
  const { customerId, points, note } = parsed.data;

  const customer = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!customer) {
    return NextResponse.json({ error: "Müşteri bulunamadı." }, { status: 404 });
  }
  if (customer.loyaltyPoints + points < 0) {
    return NextResponse.json({ error: "Bu düzeltme bakiyeyi negatife düşürür." }, { status: 400 });
  }

  const updated = await prisma.$transaction(async (tx) => {
    await tx.loyaltyTransaction.create({
      data: { customerId, points, reason: "ADMIN_DUZELTME" }
    });
    return tx.customer.update({ where: { id: customerId }, data: { loyaltyPoints: { increment: points } } });
  });

  logAudit({
    actorEmail: session.user?.email ?? "bilinmiyor",
    actorRole: session.user?.role ?? "ADMIN",
    action: "LOYALTY_ADJUSTED",
    targetType: "Customer",
    targetId: customerId,
    detail: `${points > 0 ? "+" : ""}${points} puan${note ? ` (${note})` : ""}`
  });

  return NextResponse.json({ ok: true, newBalance: updated.loyaltyPoints });
}
