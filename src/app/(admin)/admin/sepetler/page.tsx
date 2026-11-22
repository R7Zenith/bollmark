import Link from "next/link";
import { ShoppingBasket, Wallet, Calculator } from "lucide-react";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-admin";
import { parseStoredCartLines, resolveManyCarts } from "@/lib/cart-lines";
import { resolvePeriodRange } from "@/lib/order-period";
import { formatDateTime, formatExactPrice, formatRelativeTime } from "@/lib/format";
import { formatTrMobile } from "@/lib/phone";
import { EmptyState } from "@/components/admin/empty-state";
import { StatCard } from "@/components/admin/stat-card";
import { OrdersPeriodSelect } from "@/components/admin/orders-period-select";
import { Pagination } from "@/components/admin/pagination";
import { ActiveCartFilters } from "@/components/admin/active-cart-filters";
import { ActiveCartsTable, type ActiveCartRow } from "@/components/admin/active-carts-table";

const PATH = "/admin/sepetler";
const PAGE_SIZE = 50;
const NON_EMPTY: Prisma.CustomerCartWhereInput = { linesJson: { not: "[]" } };

interface SearchParams {
  q?: string;
  donem?: string;
  baslangic?: string;
  bitis?: string;
  sirala?: string;
  page?: string;
}

function guestNote() {
  return (
    <p className="mt-6 text-xs text-admin-text-muted">
      Giriş yapmamış ziyaretçilerin sepetleri tarayıcılarında tutulur ve burada görünmez. Ödeme sayfasında e-posta
      bırakan misafirler için:{" "}
      <Link href="/admin/terk-edilmis-sepetler" className="text-admin-accent hover:underline">
        Terk Edilmiş Sepetler
      </Link>
    </p>
  );
}

// Uye musterilerin su anki sepetleri (CustomerCart, PUT /api/sepet ile yazilir).
// Filtreye uyan tum sepetler hafif kolonlarla cekilir ve satirlari TEK urun
// sorgusuyla cozumlenir; boylece kartlar ve "tutar" siralamasi tum kumeye
// gore calisir, sayfalama bellekte yapilir. Yalniz ADMIN (bkz. lib/roles.ts).
export default async function ActiveCartsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireAdmin();
  const { q, donem, baslangic, bitis, sirala, page: pageParam } = await searchParams;

  const totalAllTime = await prisma.customerCart.count({ where: NON_EMPTY });
  if (totalAllTime === 0) {
    return (
      <div>
        <h1 className="text-2xl font-semibold text-admin-text">Aktif Sepetler</h1>
        <div className="mt-8 rounded-lg border border-admin-border bg-admin-surface">
          <EmptyState
            icon={ShoppingBasket}
            title="Henüz aktif sepet yok"
            description="Üye müşteriler sepete ürün eklediğinde burada görünecek."
          />
        </div>
        {guestNote()}
      </div>
    );
  }

  const periodRange = resolvePeriodRange(donem, baslangic, bitis);
  const needle = q?.trim();
  // Telefon DB'de +905xxxxxxxxx; "0532 123..." gibi aramalar rakama indirgenir.
  const phoneDigits = needle?.replace(/\D/g, "").replace(/^(90|0)/, "") ?? "";

  const where: Prisma.CustomerCartWhereInput = {
    ...NON_EMPTY,
    ...(periodRange.current.start && periodRange.current.end
      ? { updatedAt: { gte: periodRange.current.start, lte: periodRange.current.end } }
      : {}),
    ...(needle
      ? {
          customer: {
            OR: [
              { name: { contains: needle, mode: "insensitive" } },
              { email: { contains: needle, mode: "insensitive" } },
              ...(phoneDigits.length >= 3 ? [{ phone: { contains: phoneDigits } }] : [])
            ]
          }
        }
      : {})
  };

  const carts = await prisma.customerCart.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      linesJson: true,
      couponCode: true,
      updatedAt: true,
      customer: { select: { id: true, name: true, email: true, phone: true } }
    }
  });

  const inputs = carts.map((c) => parseStoredCartLines(c.linesJson));
  const resolved = await resolveManyCarts(inputs);
  const now = new Date();

  const allRows: ActiveCartRow[] = carts.flatMap((c, i) => {
    // Silinmis urun satirlari (name === "") ozetten ve tutardan cikar.
    const lines = resolved[i].filter((l) => l.name !== "");
    if (lines.length === 0) return [];
    return [
      {
        id: c.id,
        customerId: c.customer.id,
        customerName: c.customer.name,
        customerEmail: c.customer.email,
        customerPhone: c.customer.phone ? formatTrMobile(c.customer.phone) : null,
        lines,
        itemsSummary: lines
          .map((l) => {
            const variant = [l.color, l.size].filter(Boolean).join(", ");
            return `${l.name}${variant ? ` (${variant})` : ""} ×${l.quantity}`;
          })
          .join(" · "),
        itemCount: lines.reduce((sum, l) => sum + l.quantity, 0),
        totalCents: lines.reduce((sum, l) => sum + l.quantity * l.priceCents, 0),
        couponCode: c.couponCode,
        updatedAtRelative: formatRelativeTime(c.updatedAt, now),
        updatedAtFull: formatDateTime(c.updatedAt)
      }
    ];
  });

  if (sirala === "tutar") allRows.sort((a, b) => b.totalCents - a.totalCents);

  const cartCount = allRows.length;
  const totalCents = allRows.reduce((sum, r) => sum + r.totalCents, 0);
  const totalPages = Math.max(1, Math.ceil(cartCount / PAGE_SIZE));
  const page = Math.min(totalPages, Math.max(1, Number(pageParam) || 1));
  const rows = allRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const baseParams = new URLSearchParams();
  if (q) baseParams.set("q", q);
  if (donem) baseParams.set("donem", donem);
  if (donem === "ozel") {
    if (baslangic) baseParams.set("baslangic", baslangic);
    if (bitis) baseParams.set("bitis", bitis);
  }
  if (sirala) baseParams.set("sirala", sirala);
  const paginationBaseUrl = `${PATH}${baseParams.toString() ? `?${baseParams.toString()}` : ""}`;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-admin-text">Aktif Sepetler</h1>
        <OrdersPeriodSelect />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard icon={ShoppingBasket} label="Aktif Sepet" value={cartCount} />
        <StatCard icon={Wallet} label="Sepetlerdeki Toplam Tutar" value={formatExactPrice(totalCents)} />
        <StatCard
          icon={Calculator}
          label="Ortalama Sepet Tutarı"
          value={formatExactPrice(cartCount ? Math.round(totalCents / cartCount) : 0)}
        />
      </div>

      <div className="mt-6">
        <ActiveCartFilters />
      </div>

      <div className="mt-4">
        {rows.length === 0 ? (
          <div className="rounded-lg border border-admin-border bg-admin-surface">
            <EmptyState
              icon={ShoppingBasket}
              title="Sonuç bulunamadı"
              description="Arama veya dönem filtresine uygun aktif sepet yok."
            />
          </div>
        ) : (
          <ActiveCartsTable carts={rows} />
        )}
      </div>

      {totalPages > 1 && (
        <div className="mt-3 rounded-lg border border-admin-border bg-admin-surface">
          <Pagination page={page} totalPages={totalPages} baseUrl={paginationBaseUrl} />
        </div>
      )}

      {guestNote()}
    </div>
  );
}
