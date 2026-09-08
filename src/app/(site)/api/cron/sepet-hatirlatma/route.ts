import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/mail";
import { parseCartLines, buildAbandonedCartReminderHtml } from "@/lib/abandoned-carts";

// Vercel Cron tarafindan gunde bir kez tetiklenir (bkz. vercel.json, saat
// 08:00), Vercel'in otomatik ekledigi "Authorization: Bearer $CRON_SECRET"
// header'i ile korunur. StoreSettings.abandonedCartReminderEnabled kapaliysa
// hic calismaz; acikken recoveredAt=null (siparis tamamlanmamis) ve
// remindedAt=null (daha once hatirlatma gonderilmemis) olan, en az
// abandonedCartReminderHours saat once olusturulmus kayitlar bulunup Resend
// ile hatirlatma maili gonderilir, sonra remindedAt isaretlenir. Gunde 1 kez
// calistigi icin "saat" kesin bir gonderim zamani degil, bir esiktir - admin
// panelde (admin/terk-edilmis-sepetler) beklemeden elle de gonderilebilir.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  }

  const settings = await prisma.storeSettings.upsert({
    where: { id: "singleton" },
    create: { id: "singleton" },
    update: {}
  });

  if (!settings.abandonedCartReminderEnabled) {
    return NextResponse.json({ ok: true, remindedCount: 0, skipped: "devre-disi" });
  }

  const hours = Math.max(1, settings.abandonedCartReminderHours);
  const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
  const carts = await prisma.abandonedCart.findMany({
    where: { recoveredAt: null, remindedAt: null, createdAt: { lte: cutoff } }
  });

  for (const cart of carts) {
    const lines = parseCartLines(cart.linesJson);
    await sendMail({
      to: cart.email,
      subject: "Sepetinizde ürünler sizi bekliyor",
      html: buildAbandonedCartReminderHtml(lines, cart.totalCents)
    });
    await prisma.abandonedCart.update({ where: { id: cart.id }, data: { remindedAt: new Date() } });
  }

  return NextResponse.json({ ok: true, remindedCount: carts.length });
}
