import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/mail";
import { formatPrice } from "@/lib/format";

type CartLineSnapshot = { name: string; size: string; color: string; quantity: number; priceCents: number };

// Vercel Cron tarafindan gunde bir kez tetiklenir (bkz. vercel.json), Vercel'in
// otomatik ekledigi "Authorization: Bearer $CRON_SECRET" header'i ile korunur.
// recoveredAt=null (siparis tamamlanmamis) ve remindedAt=null (daha once
// hatirlatma gonderilmemis) olan, en az 1 saat once olusturulmus kayitlar
// bulunup Resend ile hatirlatma maili gonderilir, sonra remindedAt isaretlenir.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  }

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const carts = await prisma.abandonedCart.findMany({
    where: { recoveredAt: null, remindedAt: null, createdAt: { lte: oneHourAgo } }
  });

  for (const cart of carts) {
    const lines: CartLineSnapshot[] = JSON.parse(cart.linesJson);
    const itemsHtml = lines
      .map((l) => `<li>${l.name} (${l.color}, ${l.size}) × ${l.quantity}</li>`)
      .join("");
    await sendMail({
      to: cart.email,
      subject: "Sepetinizde ürünler sizi bekliyor",
      html: `<p>Sepetinizde sizi bekleyen ürünler var:</p><ul>${itemsHtml}</ul><p>Toplam: ${formatPrice(cart.totalCents)}</p><p><a href="https://bollmark.com/sepet">Sepetine dön</a></p>`
    });
    await prisma.abandonedCart.update({ where: { id: cart.id }, data: { remindedAt: new Date() } });
  }

  return NextResponse.json({ ok: true, remindedCount: carts.length });
}
