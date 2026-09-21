import { redirect } from "next/navigation";
import { Ticket, MousePointerClick, PiggyBank } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-admin";
import { Card } from "@/components/admin/card";
import { StatCard } from "@/components/admin/stat-card";
import { KampanyalarFilters } from "@/components/admin/kampanyalar-filters";
import { CouponRow, type CouponData, type CategoryOption, type BrandOption } from "@/components/admin/coupon-row";
import { CouponCategoryBrandGenderFields } from "@/components/admin/coupon-category-brand-gender-fields";
import { CouponFeedback } from "@/components/admin/coupon-feedback";
import { CouponIdentityField } from "@/components/admin/coupon-identity-field";
import { CouponValueField } from "@/components/admin/coupon-value-field";
import { logAudit } from "@/lib/audit-log";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { buildCategoryOptions } from "@/lib/category-tree";
import { computeCouponStatus, couponStatuses, type CouponStatus } from "@/lib/status";
import { formatDate, formatPrice, istanbulDateKey, istanbulDayEnd, istanbulDayStart } from "@/lib/format";

const inputClass =
  "w-full rounded-md border border-admin-border px-3 py-2 text-sm focus:border-admin-accent focus:outline-none focus:ring-1 focus:ring-admin-accent";
const labelClass = "text-xs font-medium uppercase tracking-wide text-admin-text-muted";

function readCouponFields(formData: FormData) {
  const codeRaw = String(formData.get("code") || "")
    .trim()
    .toUpperCase();
  const nameRaw = String(formData.get("name") || "").trim();
  // Kod bosken (Otomatik kampanya) code null olarak saklanir - Postgres
  // nullable unique alanda birden fazla NULL'a izin verdigi icin cakisma
  // olmaz. Kod bossa gorunen ad (name) zorunludur.
  const code = codeRaw || null;
  const name = nameRaw || null;
  const type = String(formData.get("type") || "PERCENT");
  const valueRaw = Number(formData.get("value") || 0);
  const value = type === "FIXED" ? Math.round(valueRaw * 100) : Math.max(0, Math.round(valueRaw));
  const minOrderCents = Math.round(Number(formData.get("minOrderCents") || 0) * 100);
  const usageLimitRaw = String(formData.get("usageLimit") || "").trim();
  const usageLimit = usageLimitRaw ? Math.max(1, Math.round(Number(usageLimitRaw))) : null;
  const startsAtRaw = String(formData.get("startsAt") || "").trim();
  const expiresAtRaw = String(formData.get("expiresAt") || "").trim();
  const isActive = formData.get("isActive") === "on";
  const categoryIds = formData.getAll("categoryIds").map(String).filter(Boolean);
  const brandIds = formData.getAll("brandIds").map(String).filter(Boolean);
  const genders = formData.getAll("genders").map(String).filter(Boolean);
  const includeManuallyDiscountedProducts = formData.get("includeManuallyDiscountedProducts") === "on";

  return {
    code,
    name,
    type,
    value,
    minOrderCents,
    usageLimit,
    startsAt: startsAtRaw ? istanbulDayStart(startsAtRaw) : null,
    expiresAt: expiresAtRaw ? istanbulDayEnd(expiresAtRaw) : null,
    isActive,
    categoryIds,
    brandIds,
    genders,
    includeManuallyDiscountedProducts
  };
}

async function createCoupon(formData: FormData) {
  "use server";
  const fields = readCouponFields(formData);
  if (!fields.code && !fields.name) redirect("/admin/kampanyalar?hata=ad-gerekli");

  let created;
  try {
    created = await prisma.coupon.create({ data: fields });
  } catch {
    redirect("/admin/kampanyalar?hata=kod-tekrar");
  }

  if (!fields.code) {
    const session = await getServerSession(authOptions);
    logAudit({
      actorEmail: session?.user?.email ?? "bilinmiyor",
      actorRole: session?.user?.role ?? "ADMIN",
      action: "KAMPANYA_OTOMATIK_OLUSTURULDU",
      targetType: "Coupon",
      targetId: created.id,
      detail: fields.name ?? undefined
    });
  }
  redirect("/admin/kampanyalar?basarili=eklendi");
}

async function updateCoupon(id: string, formData: FormData) {
  "use server";
  const fields = readCouponFields(formData);
  if (!fields.code && !fields.name) redirect("/admin/kampanyalar?hata=ad-gerekli");

  const existing = await prisma.coupon.findUnique({ where: { id } });
  try {
    await prisma.coupon.update({ where: { id }, data: fields });
  } catch {
    redirect("/admin/kampanyalar?hata=kod-tekrar");
  }

  if (existing && existing.includeManuallyDiscountedProducts !== fields.includeManuallyDiscountedProducts) {
    const session = await getServerSession(authOptions);
    logAudit({
      actorEmail: session?.user?.email ?? "bilinmiyor",
      actorRole: session?.user?.role ?? "ADMIN",
      action: "KAMPANYA_KAPSAM_DEGISTIRILDI",
      targetType: "Coupon",
      targetId: id,
      detail: `"${fields.name ?? fields.code ?? id}" kampanyası artık elle indirimli ürünlerde ${fields.includeManuallyDiscountedProducts ? "geçerli" : "geçersiz"}.`
    });
  }
  redirect("/admin/kampanyalar?basarili=guncellendi");
}

async function deleteCoupon(id: string) {
  "use server";
  const coupon = await prisma.coupon.findUnique({
    where: { id },
    include: { _count: { select: { orders: true } } }
  });
  if (!coupon) redirect("/admin/kampanyalar?hata=bulunamadi");
  if (coupon._count.orders > 0) redirect("/admin/kampanyalar?hata=kullanilmis");
  await prisma.coupon.delete({ where: { id } });
  redirect("/admin/kampanyalar?basarili=silindi");
}

function toDateInputValue(date: Date | null): string | null {
  if (!date) return null;
  return istanbulDateKey(date);
}

export default async function AdminCouponsPage({
  searchParams
}: {
  searchParams: Promise<{ basarili?: string; hata?: string; q?: string; durum?: string }>;
}) {
  await requireAdmin();
  const { basarili, hata, q, durum } = await searchParams;

  const [coupons, categoriesRaw, brands, usageAgg] = await Promise.all([
    prisma.coupon.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.category.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.brand.findMany({ orderBy: { name: "asc" } }),
    prisma.order.aggregate({ where: { couponId: { not: null } }, _sum: { discountCents: true } })
  ]);

  const categoryOptions: CategoryOption[] = buildCategoryOptions(categoriesRaw).map((o) => ({
    id: o.id,
    label: o.label
  }));
  const categoryLabelById = new Map(categoryOptions.map((c) => [c.id, c.label]));
  const brandOptions: BrandOption[] = brands.map((b) => ({ id: b.id, name: b.name }));
  const brandNameById = new Map(brandOptions.map((b) => [b.id, b.name]));

  const couponIds = coupons.map((c) => c.id);
  const usageOrders = couponIds.length
    ? await prisma.order.findMany({
        where: { couponId: { in: couponIds } },
        orderBy: { createdAt: "desc" },
        select: { couponId: true, orderNumber: true, createdAt: true, discountCents: true }
      })
    : [];
  const usageByCoupon = new Map<string, typeof usageOrders>();
  for (const o of usageOrders) {
    if (!o.couponId) continue;
    const list = usageByCoupon.get(o.couponId) ?? [];
    list.push(o);
    usageByCoupon.set(o.couponId, list);
  }

  let rows: CouponData[] = coupons.map((c) => ({
    id: c.id,
    code: c.code,
    name: c.name,
    type: c.type,
    value: c.value,
    minOrderCents: c.minOrderCents,
    usageLimit: c.usageLimit,
    usedCount: c.usedCount,
    startsAt: toDateInputValue(c.startsAt),
    expiresAt: toDateInputValue(c.expiresAt),
    isActive: c.isActive,
    categoryIds: c.categoryIds,
    categoryLabels: c.categoryIds.map((id) => categoryLabelById.get(id)).filter((v): v is string => Boolean(v)),
    brandIds: c.brandIds,
    brandNames: c.brandIds.map((id) => brandNameById.get(id)).filter((v): v is string => Boolean(v)),
    genders: c.genders,
    includeManuallyDiscountedProducts: c.includeManuallyDiscountedProducts,
    status: computeCouponStatus(c),
    usageOrders: (usageByCoupon.get(c.id) ?? []).slice(0, 5).map((o) => ({
      orderNumber: o.orderNumber,
      createdAtLabel: formatDate(o.createdAt),
      discountCents: o.discountCents
    }))
  }));

  if (q) {
    const needle = q.trim().toLowerCase();
    rows = rows.filter(
      (r) => (r.code ?? "").toLowerCase().includes(needle) || (r.name ?? "").toLowerCase().includes(needle)
    );
  }
  if (durum && couponStatuses.includes(durum as CouponStatus)) {
    rows = rows.filter((r) => r.status === durum);
  }

  const activeCount = coupons.filter((c) => computeCouponStatus(c) === "AKTIF").length;
  const totalUsage = coupons.reduce((sum, c) => sum + c.usedCount, 0);
  const totalDiscountCents = usageAgg._sum.discountCents ?? 0;

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold text-admin-text">Kampanyalar</h1>

      <CouponFeedback basarili={basarili} hata={hata} />

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard icon={Ticket} label="Aktif Kampanya" value={activeCount} />
        <StatCard icon={MousePointerClick} label="Toplam Kullanım" value={totalUsage} />
        <StatCard icon={PiggyBank} label="Sağlanan Toplam İndirim" value={formatPrice(totalDiscountCents)} />
      </div>

      <Card title="Yeni Kupon" className="mt-6">
        <form action={createCoupon} className="space-y-3">
          <CouponIdentityField />
          <CouponValueField />
          <div>
            <label className={labelClass}>Min. Sepet Tutarı (TL)</label>
            <input name="minOrderCents" type="number" step="0.01" min={0} className={`mt-1 ${inputClass}`} />
          </div>
          <CouponCategoryBrandGenderFields
            categories={categoryOptions}
            brands={brandOptions}
            defaultCategoryIds={[]}
            defaultBrandIds={[]}
            defaultGenders={[]}
          />
          <div>
            <label className="flex items-center gap-2 text-sm text-admin-text">
              <input
                type="checkbox"
                name="includeManuallyDiscountedProducts"
                className="h-4 w-4 rounded border-admin-border text-admin-accent focus:ring-admin-accent"
              />
              Elle indirim yapılmış ürünlerde de bu kampanya geçerli olsun
            </label>
            <p className="mt-1 text-xs text-admin-text-muted">
              Kapalıyken bu kampanya, üzerinde zaten indirim yaptığınız ürünlere dokunmaz. Açarsanız, ürünün mevcut
              indirimiyle bu kampanya karşılaştırılır ve müşteriye hangisi daha avantajlıysa o gösterilir (indirimler
              üst üste eklenmez).
            </p>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div>
              <label className={labelClass}>Kullanım Limiti</label>
              <input name="usageLimit" type="number" min={1} placeholder="Sınırsız" className={`mt-1 ${inputClass}`} />
            </div>
            <div>
              <label className={labelClass}>Başlangıç</label>
              <input name="startsAt" type="date" className={`mt-1 ${inputClass}`} />
            </div>
            <div>
              <label className={labelClass}>Bitiş</label>
              <input name="expiresAt" type="date" className={`mt-1 ${inputClass}`} />
            </div>
          </div>
          <div className="flex items-center justify-between pt-1">
            <label className="flex items-center gap-2 text-sm text-admin-text">
              <input
                type="checkbox"
                name="isActive"
                defaultChecked
                className="h-4 w-4 rounded border-admin-border text-admin-accent focus:ring-admin-accent"
              />
              Aktif
            </label>
            <button className="rounded-md bg-admin-accent px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700">
              Ekle
            </button>
          </div>
        </form>
      </Card>

      <div className="mt-6">
        <KampanyalarFilters />
      </div>

      <ul className="mt-4 divide-y divide-admin-border rounded-lg border border-admin-border bg-admin-surface">
        {rows.map((c) => (
          <CouponRow
            key={c.id}
            coupon={c}
            categories={categoryOptions}
            brands={brandOptions}
            updateAction={updateCoupon.bind(null, c.id)}
            deleteAction={deleteCoupon.bind(null, c.id)}
          />
        ))}
        {rows.length === 0 && (
          <li className="px-4 py-6 text-center text-sm text-admin-text-muted">Henüz kampanya yok.</li>
        )}
      </ul>
    </div>
  );
}
