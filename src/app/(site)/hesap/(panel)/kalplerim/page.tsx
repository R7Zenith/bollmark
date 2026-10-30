import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Heart } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireCustomer } from "@/lib/require-customer";
import { firstImageUrl } from "@/lib/catalog";
import { campaignStateFrom, getKalpSettings } from "@/lib/kalp-topla/settings";
import { settlePending } from "@/lib/kalp-topla/bar";
import { ensureReferralCode } from "@/lib/kalp-topla/invite";
import { inviteHistoryLabel, maskName } from "@/lib/kalp-topla/invite-rules";
import { DavetHedefSecici, DavetPaylasim } from "@/components/kalp-topla/davet-paylas";
import { WithdrawHeartButton } from "./withdraw-button";

export const metadata = { title: "Kalplerim", robots: { index: false } };

function remaining(expiresAt: Date, now: number): string {
  const minutes = Math.max(Math.floor((expiresAt.getTime() - now) / 60000), 0);
  const hours = Math.floor(minutes / 60);
  return hours > 0 ? `${hours} saat ${minutes % 60} dk kaldı` : `${minutes} dk kaldı`;
}

const DAY_MS = 24 * 60 * 60 * 1000;

// Bekleyen bonuslar ve davet gecmisi (plan 6.4, Y5).
async function loadInvites(customerId: string) {
  const [invites, waiting] = await Promise.all([
    prisma.kalpInvite.findMany({ where: { inviterId: customerId }, orderBy: { createdAt: "desc" }, take: 30 }),
    prisma.kalpBonusCredit.findMany({
      where: { customerId, status: "WAITING", expiresAt: { gt: new Date() } },
      orderBy: { expiresAt: "asc" },
      select: { id: true, points: true, expiresAt: true }
    })
  ]);
  const [credits, invitees] = await Promise.all([
    prisma.kalpBonusCredit.findMany({
      where: { inviteId: { in: invites.map((i) => i.id) } },
      select: { inviteId: true, status: true, points: true }
    }),
    prisma.customer.findMany({ where: { id: { in: invites.map((i) => i.inviteeId) } }, select: { id: true, name: true } })
  ]);
  const nameById = new Map(invitees.map((c) => [c.id, c.name]));
  return {
    waiting: waiting.map((c) => ({
      ...c,
      days: Math.max(Math.ceil(((c.expiresAt?.getTime() ?? 0) - Date.now()) / DAY_MS), 0)
    })),
    history: invites.map((i) => ({
      id: i.id,
      name: maskName(nameById.get(i.inviteeId) ?? ""),
      label: inviteHistoryLabel(i.status, credits.filter((c) => c.inviteId === i.id))
    }))
  };
}

// Test-iptal kuponlar gorunmez (Y15). Kalan sure sayfa uretildigi andaki saate gore.
async function loadCoupons(customerId: string) {
  const list = await prisma.kalpCoupon.findMany({
    where: { customerId, status: { not: "TEST_CANCELLED" } },
    orderBy: { createdAt: "desc" },
    take: 20
  });
  return { list, now: Date.now() };
}

// Hesabim > Kalplerim (KALP_TOPLA_PLANI.md 6.4): kalan hak, aktif ve bekleyen
// kalpler (bar + geri cek), bekleyen bonuslar, kuponlar (kullanici karari, Faz 4),
// davet linki ve gecmisi.
export default async function HesapKalplerimPage() {
  const session = await requireCustomer();
  const customerId = session.user!.id!;
  const settings = await getKalpSettings();
  const state = await campaignStateFrom(settings, customerId);
  if (state === "INVISIBLE") notFound();
  if (state === "ACTIVE") await settlePending(customerId, settings);

  const [customer, hearts, coupons, invites, referralCode] = await Promise.all([
    prisma.customer.findUnique({ where: { id: customerId }, select: { emailVerifiedAt: true, inviteTargetProductId: true } }),
    prisma.kalpHeart.findMany({
      where: { customerId, status: { in: ["PENDING", "ACTIVE"] } },
      orderBy: { createdAt: "asc" },
      select: { id: true, productId: true, status: true }
    }),
    loadCoupons(customerId),
    loadInvites(customerId),
    ensureReferralCode(customerId)
  ]);
  const productIds = hearts.map((h) => h.productId);
  const [products, bars] = await Promise.all([
    prisma.product.findMany({
      where: { id: { in: productIds } },
      select: {
        id: true,
        name: true,
        slug: true,
        images: { orderBy: { position: "asc" }, take: 1 },
        optionImages: { orderBy: { position: "asc" }, take: 1 }
      }
    }),
    prisma.kalpBar.findMany({ where: { productId: { in: productIds } } })
  ]);
  const rounds = await prisma.kalpRound.findMany({
    where: { id: { in: bars.map((b) => b.currentRoundId) } },
    select: { id: true, threshold: true }
  });
  const productById = new Map(products.map((p) => [p.id, p]));
  const barByProduct = new Map(bars.map((b) => [b.productId, b]));
  const thresholdByRound = new Map(rounds.map((r) => [r.id, r.threshold]));
  const left = Math.max(settings.heartQuota - hearts.length, 0);

  return (
    <div className="space-y-10">
      <div>
        <h2 className="font-display text-xl">Kalplerim</h2>
        <p className="mt-2 text-sm text-ink/70">
          Kalan kalp hakkın:{" "}
          <span className="font-medium text-ink">
            {left}/{settings.heartQuota}
          </span>
          {hearts.some((h) => h.status === "PENDING") && " (bekleyen kalpler de hak kullanır)"}
        </p>
        {state === "FROZEN" && (
          <p className="mt-4 rounded-lg bg-ink/[0.04] px-4 py-3 text-sm text-ink/80">
            Kampanya duraklatıldı, barların korunuyor. Kalbini istersen geri çekebilirsin.
          </p>
        )}
        {!customer?.emailVerifiedAt && (
          <p className="mt-4 rounded-lg bg-ink/[0.04] px-4 py-3 text-sm text-ink/80">
            E-posta adresin doğrulanmadı. Kalplerin doğrulamadan sonra bara sayılır. Doğrulama bağlantısı e-postana
            gönderildi; bulamazsan ürün sayfasındaki barda &quot;Tekrar gönder&quot;e bas.
          </p>
        )}
      </div>

      <section>
        <h3 className="text-[15px] font-medium">Kalp verdiğin ürünler</h3>
        {hearts.length === 0 ? (
          <p className="mt-3 text-sm text-ink/60">
            Henüz kalp vermedin. Beğendiğin bir ürünün sayfasında &quot;Kalp ver&quot;e bas, bar dolunca yarı fiyatına al.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-line border-y border-line">
            {hearts.map((heart) => {
              const product = productById.get(heart.productId);
              const bar = barByProduct.get(heart.productId);
              const points = bar?.points ?? 0;
              const threshold = (bar && thresholdByRound.get(bar.currentRoundId)) ?? settings.threshold;
              const image = product ? firstImageUrl(product) : null;
              return (
                <li key={heart.id} className="flex items-center gap-4 py-4">
                  <div className="relative h-20 w-16 shrink-0 overflow-hidden rounded bg-image-bg">
                    {image && <Image src={image} alt="" fill sizes="64px" className="object-cover" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <Link href={product ? `/urunler/${product.slug}` : "#"} className="line-clamp-2 text-sm hover:underline">
                      {product?.name ?? "Ürün"}
                    </Link>
                    <div className="mt-2 h-1.5 max-w-[220px] overflow-hidden rounded-full bg-ink/10">
                      <div
                        className="h-full rounded-full bg-sale"
                        style={{ width: `${Math.min((points / threshold) * 100, 100)}%` }}
                      />
                    </div>
                    <p className="mt-1.5 text-xs text-ink/60">
                      {heart.status === "PENDING" ? "Bekliyor: e-postanı doğrulayınca sayılır" : `${points}/${threshold} kalp`}
                    </p>
                  </div>
                  <WithdrawHeartButton productId={heart.productId} />
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {invites.waiting.length > 0 && (
        <section>
          <h3 className="text-[15px] font-medium">Bekleyen bonusların</h3>
          <ul className="mt-3 space-y-1.5 text-sm text-ink/80">
            {invites.waiting.map((credit) => (
              <li key={credit.id}>
                +{credit.points} kalp · {credit.days} gün içinde ilk kalbinin barına eklenecek
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h3 className="text-[15px] font-medium">Kuponların</h3>
        {coupons.list.length === 0 ? (
          <p className="mt-3 text-sm text-ink/60">Bir bar dolduğunda %{settings.discountPercent} kuponun burada görünür.</p>
        ) : (
          <ul className="mt-4 divide-y divide-line border-y border-line">
            {coupons.list.map((coupon) => {
              const valid = coupon.status === "AVAILABLE" && coupon.expiresAt.getTime() > coupons.now;
              const label =
                coupon.status === "USED"
                  ? "Kullanıldı"
                  : coupon.status === "RESERVED"
                    ? "Ödeme bekleyen siparişte"
                    : valid
                      ? remaining(coupon.expiresAt, coupons.now)
                      : "Süresi doldu";
              return (
                <li key={coupon.id} className="flex items-center justify-between gap-4 py-4">
                  <div className="flex items-center gap-3">
                    <Heart size={16} className={valid ? "fill-sale text-sale" : "text-ink/30"} aria-hidden="true" />
                    <div>
                      <p className={`font-medium tracking-[1px] ${valid ? "text-ink" : "text-ink/40"}`}>{coupon.code}</p>
                      <p className="text-xs text-ink/60">%{coupon.discountPercent} indirim, tek ürünün tek adedinde</p>
                    </div>
                  </div>
                  <span className={`text-xs ${valid ? "text-ink" : "text-ink/50"}`}>{label}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <h3 className="text-[15px] font-medium">Arkadaşını çağır</h3>
        <p className="mt-2 text-sm text-ink/70">
          Senin linkinle üye olan arkadaşın e-postasını doğrulayınca barına +{settings.inviteBonus} kalp ekler.
        </p>
        <div className="mt-4 max-w-[480px] space-y-4">
          {hearts.length > 0 && (
            <DavetHedefSecici
              inviteBonus={settings.inviteBonus}
              value={customer?.inviteTargetProductId ?? null}
              options={hearts.map((h) => ({ productId: h.productId, name: productById.get(h.productId)?.name ?? "Ürün" }))}
            />
          )}
          <DavetPaylasim path={`/davet/${referralCode}`} />
        </div>
        {invites.history.length > 0 && (
          <ul className="mt-6 divide-y divide-line border-y border-line">
            {invites.history.map((invite) => (
              <li key={invite.id} className="flex items-center justify-between gap-4 py-3 text-sm">
                <span>{invite.name}</span>
                <span className="text-xs text-ink/60">{invite.label}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
