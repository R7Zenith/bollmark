import { History } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-admin";
import { auditActions } from "@/lib/audit-actions";
import { EmptyState } from "@/components/admin/empty-state";
import { IslemGecmisiFilters } from "@/components/admin/islem-gecmisi-filters";
import { AuditLogTable, type AuditLogRow } from "@/components/admin/audit-log-table";

interface SearchParams {
  aksiyon?: string;
  baslangic?: string;
  bitis?: string;
}

export default async function AdminIslemGecmisiPage({
  searchParams
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireAdmin();
  const { aksiyon, baslangic, bitis } = await searchParams;

  const totalCount = await prisma.auditLog.count();
  if (totalCount === 0) {
    return (
      <div>
        <h1 className="text-2xl font-semibold text-admin-text">İşlem Geçmişi</h1>
        <div className="mt-8 rounded-lg border border-admin-border bg-admin-surface">
          <EmptyState icon={History} title="Henüz denetim kaydı yok" description="Kritik bir işlem yapıldığında burada görünecek." />
        </div>
      </div>
    );
  }

  const createdAtFilter: { gte?: Date; lte?: Date } = {};
  if (baslangic) createdAtFilter.gte = new Date(`${baslangic}T00:00:00`);
  if (bitis) createdAtFilter.lte = new Date(`${bitis}T23:59:59`);

  const logs = await prisma.auditLog.findMany({
    where: {
      ...(aksiyon && (auditActions as readonly string[]).includes(aksiyon) ? { action: aksiyon } : {}),
      ...(baslangic || bitis ? { createdAt: createdAtFilter } : {})
    },
    orderBy: { createdAt: "desc" },
    take: 200
  });

  const rows: AuditLogRow[] = logs.map((log) => ({
    id: log.id,
    actorEmail: log.actorEmail,
    action: log.action,
    targetType: log.targetType,
    targetId: log.targetId,
    detail: log.detail,
    createdAtLabel: `${log.createdAt.toLocaleDateString("tr-TR")} ${log.createdAt.toLocaleTimeString("tr-TR", {
      hour: "2-digit",
      minute: "2-digit"
    })}`
  }));

  return (
    <div>
      <h1 className="text-2xl font-semibold text-admin-text">İşlem Geçmişi</h1>

      <div className="mt-6">
        <IslemGecmisiFilters />
      </div>

      <div className="mt-4">
        <AuditLogTable logs={rows} />
      </div>
    </div>
  );
}
