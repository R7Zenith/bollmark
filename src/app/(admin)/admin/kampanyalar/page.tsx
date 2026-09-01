import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/admin/card";
import { CouponRow, type CouponData } from "@/components/admin/coupon-row";
import { CouponFeedback } from "@/components/admin/coupon-feedback";

const inputClass =
  "w-full rounded-md border border-admin-border px-3 py-2 text-sm focus:border-admin-accent focus:outline-none focus:ring-1 focus:ring-admin-accent";
const labelClass = "text-xs font-medium uppercase tracking-wide text-admin-text-muted";

function readCouponFields(formData: FormData) {
  const code = String(formData.get("code") || "")
    .trim()
    .toUpperCase();
  const type = String(formData.get("type") || "PERCENT");
  const valueRaw = Number(formData.get("value") || 0);
  const value = type === "FIXED" ? Math.round(valueRaw * 100) : Math.max(0, Math.round(valueRaw));
  const minOrderCents = Math.round(Number(formData.get("minOrderCents") || 0) * 100);
  const usageLimitRaw = String(formData.get("usageLimit") || "").trim();
  const usageLimit = usageLimitRaw ? Math.max(1, Math.round(Number(usageLimitRaw))) : null;
  const startsAtRaw = String(formData.get("startsAt") || "").trim();
  const expiresAtRaw = String(formData.get("expiresAt") || "").trim();
  const isActive = formData.get("isActive") === "on";

  return {
    code,
    type,
    value,
    minOrderCents,
    usageLimit,
    startsAt: startsAtRaw ? new Date(startsAtRaw) : null,
    expiresAt: expiresAtRaw ? new Date(expiresAtRaw) : null,
    isActive
  };
}

async function createCoupon(formData: FormData) {
  "use server";
  const fields = readCouponFields(formData);
  if (!fields.code) redirect("/admin/kampanyalar?hata=kod-gerekli");

  try {
    await prisma.coupon.create({ data: fields });
  } catch {
    redirect("/admin/kampanyalar?hata=kod-tekrar");
  }
  redirect("/admin/kampanyalar?basarili=eklendi");
}

async function updateCoupon(id: string, formData: FormData) {
  "use server";
  const fields = readCouponFields(formData);
  if (!fields.code) redirect("/admin/kampanyalar?hata=kod-gerekli");

  try {
    await prisma.coupon.update({ where: { id }, data: fields });
  } catch {
    redirect("/admin/kampanyalar?hata=kod-tekrar");
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
  return date.toISOString().slice(0, 10);
}

export default async function AdminCouponsPage({
  searchParams
}: {
  searchParams: Promise<{ basarili?: string; hata?: string }>;
}) {
  const { basarili, hata } = await searchParams;
  const coupons = await prisma.coupon.findMany({ orderBy: { createdAt: "desc" } });

  const rows: CouponData[] = coupons.map((c) => ({
    id: c.id,
    code: c.code,
    type: c.type,
    value: c.value,
    minOrderCents: c.minOrderCents,
    usageLimit: c.usageLimit,
    usedCount: c.usedCount,
    startsAt: toDateInputValue(c.startsAt),
    expiresAt: toDateInputValue(c.expiresAt),
    isActive: c.isActive
  }));

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold text-admin-text">Kampanyalar</h1>

      <CouponFeedback basarili={basarili} hata={hata} />

      <Card title="Yeni Kupon" className="mt-6">
        <form action={createCoupon} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Kod</label>
              <input
                name="code"
                required
                placeholder="HOSGELDIN10"
                className={`mt-1 ${inputClass} font-mono uppercase`}
              />
            </div>
            <div>
              <label className={labelClass}>Tip</label>
              <select name="type" defaultValue="PERCENT" className={`mt-1 ${inputClass}`}>
                <option value="PERCENT">Yüzde İndirim</option>
                <option value="FIXED">Sabit Tutar (TL)</option>
                <option value="FREE_SHIPPING">Ücretsiz Kargo</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Değer (% veya TL)</label>
              <input name="value" type="number" step="0.01" min={0} defaultValue={10} className={`mt-1 ${inputClass}`} />
            </div>
            <div>
              <label className={labelClass}>Min. Sepet Tutarı (TL)</label>
              <input name="minOrderCents" type="number" step="0.01" min={0} className={`mt-1 ${inputClass}`} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
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

      <ul className="mt-6 divide-y divide-admin-border rounded-lg border border-admin-border bg-admin-surface">
        {rows.map((c) => (
          <CouponRow
            key={c.id}
            coupon={c}
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
