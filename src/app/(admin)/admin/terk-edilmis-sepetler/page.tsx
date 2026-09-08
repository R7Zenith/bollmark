import { ShoppingCart, Mail, RotateCcw, Percent } from "lucide-react";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-admin";
import { sendMail } from "@/lib/mail";
import { logAudit } from "@/lib/audit-log";
import { parseCartLines, summarizeCartLines, buildAbandonedCartReminderHtml } from "@/lib/abandoned-carts";
import { resolvePeriodRange } from "@/lib/order-period";
import { getAbandonedCartStats } from "@/lib/abandoned-cart-stats";
import { EmptyState } from "@/components/admin/empty-state";
import { StatCard } from "@/components/admin/stat-card";
import { OrdersPeriodSelect } from "@/components/admin/orders-period-select";
import { AbandonedCartFilters } from "@/components/admin/abandoned-cart-filters";
import { AbandonedCartsTable, type AbandonedCartRow } from "@/components/admin/abandoned-carts-table";
import { AbandonedCartFeedback } from "@/components/admin/abandoned-cart-feedback";

const PATH = "/admin/terk-edilmis-sepetler";

// Gunluk cron'u beklemeden tek bir sepete hemen hatirlatma gonderir - ayni
// e-posta icerigini (lib/abandoned-carts.ts) kullanir, sadece tetikleyici
// elle admin tarafindan.
async function resendReminderAction(formData: FormData) {
  "use server";
  const cartId = String(formData.get("cartId") || "");
  const cart = await prisma.abandonedCart.findUnique({ where: { id: cartId } });
  if (!cart) redirect(`${PATH}?hata=bulunamadi`);
  if (cart.recoveredAt) redirect(`${PATH}?hata=kurtarilmis`);

  const lines = parseCartLines(cart.linesJson);
  await sendMail({
    to: cart.email,
    subject: "Sepetinizde ürünler sizi bekliyor",
    html: buildAbandonedCartReminderHtml(lines, cart.totalCents)
  });
  await prisma.abandonedCart.update({ where: { id: cartId }, data: { remindedAt: new Date() } });

  const session = await getServerSession(authOptions);
  logAudit({
    actorEmail: session?.user?.email ?? "bilinmiyor",
    actorRole: session?.user?.role ?? "ADMIN",
    action: "ABANDONED_CART_REMINDER_SENT",
    targetType: "AbandonedCart",
    targetId: cartId,
    detail: cart.email
  });

  redirect(`${PATH}?basarili=hatirlatma-gonderildi`);
}

interface SearchParams {
  q?: string;
  durum?: string;
  donem?: string;
  baslangic?: string;
  bitis?: string;
  basarili?: string;
  hata?: string;
}

export default async function AbandonedCartsPage({
  searchParams
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireAdmin();
  const { q, durum, donem, baslangic, bitis, basarili, hata } = await searchParams;

  const totalAllTime = await prisma.abandonedCart.count();
  if (totalAllTime === 0) {
    return (
      <div>
        <h1 className="text-2xl font-semibold text-admin-text">Terk Edilmiş Sepetler</h1>
        <div className="mt-8 rounded-lg border border-admin-border bg-admin-surface">
          <EmptyState
            icon={ShoppingCart}
            title="Henüz terk edilmiş sepet yok"
            description="Bir müşteri e-postasını girip siparişi tamamlamadan ayrılırsa burada görünecek."
          />
        </div>
      </div>
    );
  }

  const periodRange = resolvePeriodRange(donem, baslangic, bitis);

  const listWhere = {
    ...(periodRange.current.start && periodRange.current.end
      ? { createdAt: { gte: periodRange.current.start, lte: periodRange.current.end } }
      : {}),
    ...(q ? { email: { contains: q, mode: "insensitive" as const } } : {}),
    ...(durum === "BEKLIYOR"
      ? { recoveredAt: null, remindedAt: null }
      : durum === "HATIRLATILDI"
        ? { recoveredAt: null, remindedAt: { not: null } }
        : durum === "KURTARILDI"
          ? { recoveredAt: { not: null } }
          : {})
  };

  const [carts, stats] = await Promise.all([
    prisma.abandonedCart.findMany({ where: listWhere, orderBy: { createdAt: "desc" } }),
    getAbandonedCartStats(periodRange)
  ]);

  const rows: AbandonedCartRow[] = carts.map((c) => {
    const lines = parseCartLines(c.linesJson);
    return {
      id: c.id,
      email: c.email,
      itemsSummary: summarizeCartLines(lines) || "-",
      itemCount: lines.reduce((sum, l) => sum + l.quantity, 0),
      totalCents: c.totalCents,
      status: c.recoveredAt ? "KURTARILDI" : c.remindedAt ? "HATIRLATILDI" : "BEKLIYOR",
      createdAtLabel: c.createdAt.toLocaleDateString("tr-TR"),
      remindedAtLabel: c.remindedAt ? c.remindedAt.toLocaleDateString("tr-TR") : null,
      canResend: !c.recoveredAt
    };
  });

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-admin-text">Terk Edilmiş Sepetler</h1>
        <OrdersPeriodSelect />
      </div>

      <AbandonedCartFeedback basarili={basarili} hata={hata} />

      <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard
          icon={ShoppingCart}
          label="Terk Edilen Sepet"
          value={stats.totalCarts.value}
          trend={stats.totalCarts.trend}
          sparkline={stats.totalCarts.sparkline}
        />
        <StatCard
          icon={Mail}
          label="Hatırlatma Gönderilen"
          value={stats.remindedCarts.value}
          trend={stats.remindedCarts.trend}
          sparkline={stats.remindedCarts.sparkline}
        />
        <StatCard
          icon={RotateCcw}
          label="Kurtarılan"
          value={stats.recoveredCarts.value}
          trend={stats.recoveredCarts.trend}
          sparkline={stats.recoveredCarts.sparkline}
        />
        <StatCard icon={Percent} label="Kurtarma Oranı" value={stats.recoveryRate.value} trend={stats.recoveryRate.trend} />
      </div>

      <div className="mt-6">
        <AbandonedCartFilters />
      </div>

      <div className="mt-4">
        <AbandonedCartsTable carts={rows} resendAction={resendReminderAction} />
      </div>
    </div>
  );
}
