import { redirect } from "next/navigation";
import { ArrowUp, ArrowDown, Star } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-admin";
import { revalidateCatalog } from "@/lib/revalidate-catalog";
import { getOrCreateSeasonId } from "@/lib/seasons";
import { Card } from "@/components/admin/card";

// Sezonlar yeniden eskiye (rank DESC) listelenir - katalogdaki varsayilan
// siralamayla ayni yon (bkz. lib/seasons.ts sortBySeason).
async function listSeasons() {
  return prisma.season.findMany({
    include: { _count: { select: { products: true } } },
    orderBy: [{ rank: "desc" }, { name: "asc" }]
  });
}

async function createSeason(formData: FormData) {
  "use server";
  await requireAdmin();
  const name = String(formData.get("name") || "");
  if (!(await getOrCreateSeasonId(prisma, name))) redirect("/admin/sezonlar");
  revalidateCatalog();
  redirect("/admin/sezonlar");
}

// Komsu sezonla rank degis-tokus yapilir; rank'lar esitse (orn. iki taninmayan
// sezon, ikisi de 0) sadece degis-tokus sirayi degistirmeyecegi icin tasinan
// sezon komsusunun bir ustune/altina alinir.
async function moveSeason(id: string, direction: "up" | "down") {
  "use server";
  await requireAdmin();
  const seasons = await listSeasons();
  const index = seasons.findIndex((s) => s.id === id);
  const neighbor = seasons[direction === "up" ? index - 1 : index + 1];
  if (index === -1 || !neighbor) redirect("/admin/sezonlar");
  const current = seasons[index];
  const [currentRank, neighborRank] =
    current.rank === neighbor.rank
      ? [neighbor.rank + (direction === "up" ? 1 : -1), neighbor.rank]
      : [neighbor.rank, current.rank];
  await prisma.$transaction([
    prisma.season.update({ where: { id: current.id }, data: { rank: currentRank } }),
    prisma.season.update({ where: { id: neighbor.id }, data: { rank: neighborRank } })
  ]);
  revalidateCatalog();
  redirect("/admin/sezonlar");
}

// Tek bir guncel sezon olur - anasayfa "Yeni Gelenler" once onu gosterir.
// Zaten guncel olana tekrar basilirsa isaret kaldirilir.
async function toggleCurrentSeason(id: string) {
  "use server";
  await requireAdmin();
  const season = await prisma.season.findUnique({ where: { id }, select: { isCurrent: true } });
  if (!season) redirect("/admin/sezonlar");
  await prisma.$transaction([
    prisma.season.updateMany({ where: { isCurrent: true }, data: { isCurrent: false } }),
    ...(season.isCurrent ? [] : [prisma.season.update({ where: { id }, data: { isCurrent: true } })])
  ]);
  revalidateCatalog();
  redirect("/admin/sezonlar");
}

const iconButtonClass =
  "inline-flex h-8 w-8 items-center justify-center rounded-md border border-admin-border text-admin-text-muted hover:bg-admin-bg hover:text-admin-text disabled:opacity-30 disabled:hover:bg-transparent";

export default async function AdminSeasonsPage() {
  await requireAdmin();
  const [seasons, noSeasonCount] = await Promise.all([
    listSeasons(),
    prisma.product.count({ where: { seasonId: null, status: { not: "ARCHIVED" } } })
  ]);

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-semibold text-admin-text">Sezonlar</h1>
      <p className="mt-2 text-sm text-admin-text-muted">
        Katalogda ürünler önce sezona (listede üstteki önde), aynı sezon içinde eklenme tarihine göre sıralanır.
        Sezonu olmayan ürünler en sonda görünür. Excel aktarımında KOD6 sütunundaki sezon otomatik oluşturulur.
      </p>

      <Card title="Yeni Sezon" className="mt-6">
        <form action={createSeason} className="flex gap-3">
          <input
            name="name"
            required
            placeholder="örn. 2027 Kış"
            className="flex-1 rounded-md border border-admin-border px-4 py-2 text-sm focus:border-admin-accent focus:outline-none focus:ring-1 focus:ring-admin-accent"
          />
          <button className="rounded-md bg-admin-accent px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700">
            Ekle
          </button>
        </form>
      </Card>

      <ul className="mt-6 divide-y divide-admin-border rounded-lg border border-admin-border bg-admin-surface">
        {seasons.map((s, i) => (
          <li key={s.id} className="flex items-center gap-3 px-4 py-3">
            <div className="flex gap-1">
              <form action={moveSeason.bind(null, s.id, "up")}>
                <button className={iconButtonClass} disabled={i === 0} title="Yukarı taşı (daha yeni)">
                  <ArrowUp size={14} />
                </button>
              </form>
              <form action={moveSeason.bind(null, s.id, "down")}>
                <button className={iconButtonClass} disabled={i === seasons.length - 1} title="Aşağı taşı (daha eski)">
                  <ArrowDown size={14} />
                </button>
              </form>
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-admin-text">
                {s.name}
                {s.isCurrent && (
                  <span className="ml-2 rounded bg-green-50 px-1.5 py-0.5 text-xs font-normal text-green-700">
                    Güncel sezon
                  </span>
                )}
              </p>
              <p className="text-xs text-admin-text-muted">
                {s._count.products} ürün · sıra değeri {s.rank}
              </p>
            </div>
            <form action={toggleCurrentSeason.bind(null, s.id)}>
              <button
                className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs ${
                  s.isCurrent
                    ? "border-green-300 bg-green-50 text-green-700 hover:bg-green-100"
                    : "border-admin-border text-admin-text-muted hover:bg-admin-bg hover:text-admin-text"
                }`}
                title={s.isCurrent ? "Güncel sezon işaretini kaldır" : "Anasayfa 'Yeni Gelenler' önce bu sezonu göstersin"}
              >
                <Star size={12} /> {s.isCurrent ? "Güncel" : "Güncel yap"}
              </button>
            </form>
          </li>
        ))}
        {seasons.length === 0 && (
          <li className="px-4 py-6 text-center text-sm text-admin-text-muted">Henüz sezon yok.</li>
        )}
      </ul>

      {noSeasonCount > 0 && (
        <p className="mt-4 text-sm text-admin-text-muted">
          <strong>{noSeasonCount}</strong> ürünün sezonu yok (katalogda en sonda). Eski Excel&apos;leri yeniden
          aktararak ya da Ürünler listesinde toplu &quot;Sezon Ata&quot; ile doldurabilirsiniz.
        </p>
      )}
    </div>
  );
}
