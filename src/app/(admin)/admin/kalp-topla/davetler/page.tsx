import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-admin";
import { formatDateTime } from "@/lib/format";
import { Card } from "@/components/admin/card";
import { approveInviteAction, cancelInviteAction } from "./actions";

const LIST_LIMIT = 100;
const PAGE = "/admin/kalp-topla/davetler";

const FILTERS = [
  { key: "incelemede", label: "İncelemede", where: { status: "UNDER_REVIEW" } },
  { key: "kredilendi", label: "Kredilendi", where: { status: "CREDITED" } },
  { key: "bekleyen", label: "Bekleyen", where: {} },
  { key: "iptal", label: "İptal", where: { status: "CANCELLED" } },
  { key: "ayni-ip", label: "Aynı IP işaretli", where: { sameIpFlagAt: { not: null } } }
];

const STATUS_LABEL: Record<string, string> = {
  PENDING_VERIFICATION: "Doğrulama bekliyor",
  UNDER_REVIEW: "İncelemede",
  CREDITED: "Kredilendi",
  CANCELLED: "İptal"
};
const REASON_LABEL: Record<string, string> = {
  SAME_DEVICE: "Aynı cihaz",
  SAME_DEVICE_AS_INVITER: "Davet edenle aynı cihaz",
  INVITER_INELIGIBLE: "Davet eden uygun değil"
};
const CREDIT_LABEL: Record<string, string> = {
  WAITING: "bekleyen",
  APPLIED: "uygulanan",
  ROUND_CLOSED: "tur kapandı",
  VOID_WITHDRAWN: "kalp çekildi",
  EXPIRED: "süresi doldu",
  CANCELLED: "iptal"
};
const RESULT_LABEL: Record<string, string> = {
  onaylandi: "Davet onaylandı, bonus işlendi.",
  iptal: "Davet iptal edildi.",
  degismis: "Davetin durumu değişmiş, işlem yapılmadı."
};

// "Bekleyen" filtresi: bekleyen bonus kredisi olan davetler (plan 6.11).
async function filterWhere(key: string | undefined) {
  const filter = FILTERS.find((f) => f.key === key);
  if (filter?.key !== "bekleyen") return filter?.where ?? {};
  const rows = await prisma.kalpBonusCredit.findMany({
    where: { status: "WAITING" },
    distinct: ["inviteId"],
    select: { inviteId: true }
  });
  return { id: { in: rows.map((r) => r.inviteId) } };
}

// Sayac: ayni cihaz/IP ozetinden kayit olan farkli hesap sayisi.
function countAccounts(rows: { customerId: string; deviceId: string; ipHash: string | null }[]) {
  const devices = new Map<string, Set<string>>();
  const ips = new Map<string, Set<string>>();
  const add = (map: Map<string, Set<string>>, key: string, id: string) => map.set(key, (map.get(key) ?? new Set()).add(id));
  for (const row of rows) {
    add(devices, row.deviceId, row.customerId);
    if (row.ipHash) add(ips, row.ipHash, row.customerId);
  }
  return { devices, ips };
}

// Davetler ekrani (KALP_TOPLA_PLANI.md 6.11, T2, Y2, Y5, Y13). Yalniz ADMIN.
export default async function AdminKalpToplaDavetlerPage({
  searchParams
}: {
  searchParams: Promise<{ filtre?: string; sonuc?: string }>;
}) {
  await requireAdmin();
  const { filtre, sonuc } = await searchParams;
  const active = FILTERS.find((f) => f.key === filtre);
  const where = await filterWhere(filtre);
  const [invites, total] = await Promise.all([
    prisma.kalpInvite.findMany({ where, orderBy: { createdAt: "desc" }, take: LIST_LIMIT }),
    prisma.kalpInvite.count({ where })
  ]);

  const customerIds = [...new Set(invites.flatMap((i) => [i.inviterId, i.inviteeId]))];
  const [customers, credits, signups] = await Promise.all([
    prisma.customer.findMany({ where: { id: { in: customerIds } }, select: { id: true, email: true } }),
    prisma.kalpBonusCredit.findMany({
      where: { inviteId: { in: invites.map((i) => i.id) } },
      orderBy: { createdAt: "asc" },
      select: { id: true, inviteId: true, points: true, status: true, splitFromId: true }
    }),
    prisma.customerDevice.findMany({
      where: { customerId: { in: invites.map((i) => i.inviteeId) }, event: "SIGNUP" },
      select: { customerId: true, deviceId: true, ipHash: true }
    })
  ]);
  const related = await prisma.customerDevice.findMany({
    where: {
      event: "SIGNUP",
      OR: [
        { deviceId: { in: signups.map((s) => s.deviceId) } },
        { ipHash: { in: signups.flatMap((s) => (s.ipHash ? [s.ipHash] : [])) } }
      ]
    },
    select: { customerId: true, deviceId: true, ipHash: true }
  });
  const accounts = countAccounts(related);
  const customerById = new Map(customers.map((c) => [c.id, c]));
  const signupByCustomer = new Map(signups.map((s) => [s.customerId, s]));

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold text-admin-text">Kalp Topla · Davetler</h1>
      {sonuc && RESULT_LABEL[sonuc] && (
        <p className="rounded-md border border-admin-border bg-admin-surface px-4 py-3 text-sm text-admin-text">{RESULT_LABEL[sonuc]}</p>
      )}

      <div className="flex flex-wrap gap-2 text-sm">
        <Link href={PAGE} className={`rounded-md px-3 py-1.5 ${active ? "text-admin-text-muted" : "bg-admin-accent text-white"}`}>
          Tümü
        </Link>
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={`${PAGE}?filtre=${f.key}`}
            className={`rounded-md px-3 py-1.5 ${active?.key === f.key ? "bg-admin-accent text-white" : "text-admin-text-muted"}`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      <Card title={`Davetler (${Math.min(total, LIST_LIMIT)} / ${total})`}>
        {invites.length === 0 ? (
          <p className="text-sm text-admin-text-muted">Bu filtrede davet yok.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-admin-text-muted">
                <tr>
                  <th className="py-2 pr-4">Tarih (İstanbul)</th>
                  <th className="py-2 pr-4">Davet eden</th>
                  <th className="py-2 pr-4">Davetli</th>
                  <th className="py-2 pr-4">Durum</th>
                  <th className="py-2 pr-4">Cihaz / IP hesap</th>
                  <th className="py-2 pr-4">Kredi</th>
                  <th className="py-2">İşlem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-admin-border align-top text-admin-text">
                {invites.map((invite) => {
                  const signup = signupByCustomer.get(invite.inviteeId);
                  const onDevice = signup ? (accounts.devices.get(signup.deviceId)?.size ?? 0) : 0;
                  const onIp = signup?.ipHash ? (accounts.ips.get(signup.ipHash)?.size ?? 0) : 0;
                  const rows = credits.filter((c) => c.inviteId === invite.id);
                  const canApprove = invite.status === "UNDER_REVIEW";
                  const canCancel = canApprove || invite.status === "CREDITED";
                  return (
                    <tr key={invite.id}>
                      <td className="py-3 pr-4 whitespace-nowrap">{formatDateTime(invite.createdAt)}</td>
                      <td className="py-3 pr-4">{customerById.get(invite.inviterId)?.email ?? "—"}</td>
                      <td className="py-3 pr-4">{customerById.get(invite.inviteeId)?.email ?? "—"}</td>
                      <td className="py-3 pr-4">
                        {STATUS_LABEL[invite.status] ?? invite.status}
                        {invite.isTest && <span className="ml-1 text-xs text-admin-text-muted">(test)</span>}
                        {invite.reviewReasons.map((r) => (
                          <span key={r} className="mt-1 block text-xs text-amber-700">
                            {REASON_LABEL[r] ?? r}
                          </span>
                        ))}
                        {invite.sameIpFlagAt && (
                          <span className="mt-1 inline-block rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-700">aynı IP</span>
                        )}
                      </td>
                      <td className="py-3 pr-4 whitespace-nowrap">
                        {onDevice} / {onIp}
                      </td>
                      <td className="py-3 pr-4">
                        {rows.length === 0
                          ? "—"
                          : rows.map((c) => (
                              <span key={c.id} className="block text-xs">
                                +{c.points} {CREDIT_LABEL[c.status] ?? c.status}
                                {c.splitFromId && " (artan kısım)"}
                              </span>
                            ))}
                      </td>
                      <td className="py-3">
                        <div className="flex flex-col items-start gap-2">
                          {canApprove && (
                            <form action={approveInviteAction}>
                              <input type="hidden" name="id" value={invite.id} />
                              <input type="hidden" name="filtre" value={filtre ?? ""} />
                              <button className="rounded-md bg-admin-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700">
                                Onayla
                              </button>
                            </form>
                          )}
                          {canCancel && (
                            <form action={cancelInviteAction} className="flex items-center gap-2">
                              <input type="hidden" name="id" value={invite.id} />
                              <input type="hidden" name="filtre" value={filtre ?? ""} />
                              <input
                                name="note"
                                placeholder="Açıklama (opsiyonel)"
                                aria-label="İptal açıklaması"
                                className="w-40 rounded-md border border-admin-border px-2 py-1 text-xs"
                              />
                              <button className="rounded-md border border-admin-border px-3 py-1.5 text-xs text-admin-text hover:bg-slate-50">
                                İptal
                              </button>
                            </form>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <p className="text-xs text-admin-text-muted">
        Cihaz ve IP kuralları üyeliği, kalbi ya da kuponu engellemez, yalnız +2 davet bonusunu etkiler. Aynı IP yalnız işarettir, bonusu durdurmaz.
      </p>
    </div>
  );
}
