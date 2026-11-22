import { ShoppingCart, Mail, RotateCcw, Percent } from "lucide-react";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-admin";
import { sendMail } from "@/lib/mail";
import { logAudit } from "@/lib/audit-log";
import { parseCartLines, summarizeCartLines, buildAbandonedCartReminderEmail, type CartLineSnapshot } from "@/lib/abandoned-carts";
import { parseStoredCartLines, resolveCartLines, resolveManyCarts } from "@/lib/cart-lines";
import type { ResolvedCartLine } from "@/lib/cart-shared";
import type { Prisma } from "@/generated/prisma/client";
import { resolvePeriodRange } from "@/lib/order-period";
import { getAbandonedCartStats } from "@/lib/abandoned-cart-stats";
import { EmptyState } from "@/components/admin/empty-state";
import { StatCard } from "@/components/admin/stat-card";
import { OrdersPeriodSelect } from "@/components/admin/orders-period-select";
import { AbandonedCartFilters } from "@/components/admin/abandoned-cart-filters";
import { AbandonedCartsTable, type AbandonedCartRow } from "@/components/admin/abandoned-carts-table";
import { AbandonedCartFeedback } from "@/components/admin/abandoned-cart-feedback";
import { formatDate } from "@/lib/format";

const PATH = "/admin/terk-edilmis-sepetler";
// Uye sepeti bu kadar saattir dokunulmamissa terk edilmis sayilir.
const MEMBER_IDLE_HOURS = 24;

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
    ...buildAbandonedCartReminderEmail(lines, cart.totalCents),
    log: { kind: "ABANDONED_CART" }
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

// Uye sepetleri (CustomerCart) icin YALNIZ elle hatirlatma: cron bu sepetlere
// bakmaz. Mail, guncel urun/fiyatla ayni sablondan uretilir.
async function remindMemberCartAction(formData: FormData) {
  "use server";
  const cartId = String(formData.get("cartId") || "");
  const cart = await prisma.customerCart.findUnique({
    where: { id: cartId },
    select: { linesJson: true, customer: { select: { email: true } } }
  });
  if (!cart) redirect(`${PATH}?hata=bulunamadi`);

  const lines = toSnapshot(await resolveCartLines(parseStoredCartLines(cart.linesJson)));
  if (lines.length === 0) redirect(`${PATH}?hata=sepet-bos`);

  const totalCents = lines.reduce((sum, l) => sum + l.quantity * l.priceCents, 0);
  await sendMail({
    to: cart.customer.email,
    ...buildAbandonedCartReminderEmail(lines, totalCents),
    log: { kind: "ABANDONED_CART" }
  });

  const session = await getServerSession(authOptions);
  logAudit({
    actorEmail: session?.user?.email ?? "bilinmiyor",
    actorRole: session?.user?.role ?? "ADMIN",
    action: "ABANDONED_CART_REMINDER_SENT",
    targetType: "CustomerCart",
    targetId: cartId,
    detail: cart.customer.email
  });

  redirect(`${PATH}?basarili=hatirlatma-gonderildi`);
}

// Cozumlenmis satirlar -> mail/ozet icin anlik goruntu; silinmis urunler atlanir.
function toSnapshot(lines: ResolvedCartLine[]): CartLineSnapshot[] {
  return lines
    .filter((l) => l.name !== "")
    .map((l) => ({ name: l.name, size: l.size, color: l.color, quantity: l.quantity, priceCents: l.priceCents, image: l.image }));
}

// Giris yapmis, sepeti MEMBER_IDLE_HOURS'tur dokunulmamis uyeler. Odeme
// adiminda zaten acik AbandonedCart kaydi olan e-postalar ustteki listede
// gorundugu icin atlanir. Satirlar TEK urun sorgusuyla cozumlenir; "son
// hatirlatma" EmailLog'dan (yalniz to/createdAt) okunur.
async function loadMemberRows(
  periodRange: ReturnType<typeof resolvePeriodRange>,
  q: string | undefined,
  durum: string | undefined
): Promise<AbandonedCartRow[]> {
  if (durum === "KURTARILDI") return [];

  const idleCutoff = new Date(Date.now() - MEMBER_IDLE_HOURS * 60 * 60 * 1000);
  const { start, end } = periodRange.current;
  const updatedAt: Prisma.DateTimeFilter = {
    lte: end && end < idleCutoff ? end : idleCutoff,
    ...(start && end ? { gte: start } : {})
  };
  const carts = await prisma.customerCart.findMany({
    where: {
      linesJson: { not: "[]" },
      updatedAt,
      ...(q ? { customer: { email: { contains: q, mode: "insensitive" as const } } } : {})
    },
    orderBy: { updatedAt: "desc" },
    select: { id: true, linesJson: true, updatedAt: true, customer: { select: { email: true } } }
  });
  if (carts.length === 0) return [];

  const emails = [...new Set(carts.flatMap((c) => [c.customer.email, c.customer.email.toLowerCase()]))];
  const oldest = carts[carts.length - 1].updatedAt;
  const [resolved, openAbandoned, reminders] = await Promise.all([
    resolveManyCarts(carts.map((c) => parseStoredCartLines(c.linesJson))),
    prisma.abandonedCart.findMany({ where: { recoveredAt: null, email: { in: emails } }, select: { email: true } }),
    prisma.emailLog.findMany({
      where: { kind: "ABANDONED_CART", sent: true, to: { in: emails }, createdAt: { gte: oldest } },
      orderBy: { createdAt: "desc" },
      select: { to: true, createdAt: true }
    })
  ]);
  const openSet = new Set(openAbandoned.map((a) => a.email.toLowerCase()));
  const lastReminder = new Map<string, Date>();
  for (const r of reminders) if (!lastReminder.has(r.to.toLowerCase())) lastReminder.set(r.to.toLowerCase(), r.createdAt);

  return carts.flatMap((c, i): AbandonedCartRow[] => {
    const email = c.customer.email.toLowerCase();
    if (openSet.has(email)) return [];
    const lines = toSnapshot(resolved[i]);
    if (lines.length === 0) return [];
    // Sepet son hatirlatmadan sonra degistiyse yeniden "bekliyor" sayilir.
    const remindedAt = lastReminder.get(email);
    const reminded = remindedAt !== undefined && remindedAt >= c.updatedAt;
    if (durum === "BEKLIYOR" && reminded) return [];
    if (durum === "HATIRLATILDI" && !reminded) return [];
    return [
      {
        id: c.id,
        email: c.customer.email,
        itemsSummary: summarizeCartLines(lines),
        itemCount: lines.reduce((sum, l) => sum + l.quantity, 0),
        totalCents: lines.reduce((sum, l) => sum + l.quantity * l.priceCents, 0),
        status: reminded ? "HATIRLATILDI" : "BEKLIYOR",
        createdAtLabel: formatDate(c.updatedAt),
        remindedAtLabel: reminded && remindedAt ? formatDate(remindedAt) : null,
        canResend: true
      }
    ];
  });
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

  const periodRange = resolvePeriodRange(donem, baslangic, bitis);
  const [totalAllTime, memberRows] = await Promise.all([
    prisma.abandonedCart.count(),
    loadMemberRows(periodRange, q, durum)
  ]);
  if (totalAllTime === 0 && memberRows.length === 0) {
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
      createdAtLabel: formatDate(c.createdAt),
      remindedAtLabel: c.remindedAt ? formatDate(c.remindedAt) : null,
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

      <h2 className="mt-10 text-lg font-semibold text-admin-text">Üye Sepetleri</h2>
      <p className="mt-1 max-w-3xl text-sm text-admin-text-muted">
        Giriş yapmış, sepetine ürün ekleyip {MEMBER_IDLE_HOURS} saattir dokunmamış üyeler (ödeme adımında kaydı olanlar
        yukarıdaki listede). Bu sepetlere otomatik hatırlatma gitmez; istersen elle gönderebilirsin. Tutar güncel
        fiyatla ve indirimsizdir. Üstteki kartlar bu listeyi saymaz.
      </p>
      <div className="mt-4">
        <AbandonedCartsTable carts={memberRows} resendAction={remindMemberCartAction} />
      </div>
    </div>
  );
}
