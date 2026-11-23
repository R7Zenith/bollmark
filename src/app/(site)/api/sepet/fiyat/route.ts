import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { customerAuthOptions } from "@/lib/customer-auth";
import { loadPriceLines, priceCart } from "@/lib/pricing/price-cart";
import { EFSANE_CODE_NOTE } from "@/lib/efsane-cuma";

const NO_STORE = { "Cache-Control": "no-store" };

const schema = z.object({
  code: z.string(),
  lines: z.array(z.object({ productId: z.string(), variantId: z.string(), quantity: z.number().int().positive() })).min(1),
  kalpSelection: z.object({ manual: z.array(z.string()), removed: z.array(z.string()) }).optional()
});

// Sepet ve odeme onizlemesi (KALP_TOPLA_PLANI.md 5.6): siparisle ayni hesap, kilitsiz.
// Baglayici degildir; kod gecersizse kod yok sayilarak kalan indirimler yine doner.
export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "Geçersiz istek." }, { status: 400, headers: NO_STORE });
  }
  const { code, lines: input, kalpSelection } = parsed.data;

  const lines = await loadPriceLines(prisma, input);
  if (!lines) {
    return NextResponse.json({ ok: false, message: "Sepetteki bir ürün veya varyant artık mevcut değil." }, { headers: NO_STORE });
  }

  const session = await getServerSession(customerAuthOptions);
  const price = await priceCart(prisma, {
    customerId: session?.user?.id ?? null,
    lines,
    couponCode: code,
    kalpSelection,
    defaultShippingCents: 0,
    mode: "PREVIEW"
  });

  const { best } = price;
  const hasCode = code.trim().length > 0;
  const codeMessage = price.kalpCodeMessage ?? best.codeMessage;
  const efsaneBlockedCode = best.codeMessage === EFSANE_CODE_NOTE;
  const codeValid =
    !hasCode || (!efsaneBlockedCode && !price.kalpCodeMessage && !(best.codeMessage && best.couponId == null));
  // Efsane adetlerindeki otomatik kampanya payi "Indirim" satirinda kalir (bkz. price-cart.ts).
  const rawPriceOf = new Map(lines.map((l) => [l.variantId, l.priceCents]));
  const autoShareOf = new Map(
    price.efsane.map((a) => [a.variantId, (rawPriceOf.get(a.variantId)! - a.originalUnitCents) * a.count])
  );
  const lineDiscounts = [
    ...best.lineDiscounts.map((d) => ({ ...d, discountCents: d.discountCents + (autoShareOf.get(d.variantId) ?? 0) })),
    ...[...autoShareOf]
      .filter(([variantId, cents]) => cents > 0 && !best.lineDiscounts.some((d) => d.variantId === variantId))
      .map(([variantId, discountCents]) => ({ variantId, discountCents }))
  ];
  const message = price.kalpCodeApplied
    ? "Kalp Topla kuponu uygulandı."
    : (codeMessage ??
      (best.couponId
        ? best.appliedName === code.trim().toUpperCase()
          ? "Kupon uygulandı."
          : `"${best.appliedName}" kampanyası uygulandı.`
        : hasCode
          ? "Kupon uygulandı."
          : null));

  return NextResponse.json(
    {
      ok: true,
      codeValid,
      message,
      discountCents: best.discountCents + price.efsaneAutoShareCents,
      freeShipping: best.freeShipping,
      appliedName: best.appliedName,
      lineDiscounts,
      bundleDiscountCents: price.bundleDiscountCents,
      kalpDiscountCents: price.kalpDiscountCents,
      efsane: {
        active: price.efsaneActive,
        discountCents: price.efsaneDiscountCents,
        lines: price.efsane,
        combineNote: price.combineNote
      },
      pointsCapCents: price.pointsCapCents,
      kalp: price.kalp
    },
    { headers: NO_STORE }
  );
}
