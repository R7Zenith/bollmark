import { Send } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-admin";
import { formatDateTime } from "@/lib/format";
import { EMAIL_LOG_RETENTION_DAYS, emailKindLabel, isEmailKind } from "@/lib/email/log";
import { EmptyState } from "@/components/admin/empty-state";
import { Pagination } from "@/components/admin/pagination";
import { EmailLogFilters } from "@/components/admin/email-log-filters";
import { EmailLogTable, type EmailLogRow } from "@/components/admin/email-log-table";

// Musteriye giden e-postalar (EmailLog). Liste yalniz ust bilgiyi okur, icerik detayda.
const PAGE_SIZE = 30;

interface SearchParams {
  q?: string;
  tur?: string;
  durum?: string;
  page?: string;
}

export default async function AdminSentEmailsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireAdmin();
  const { q, tur, durum, page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);

  const totalAllTime = await prisma.emailLog.count();
  if (totalAllTime === 0) {
    return (
      <div>
        <h1 className="text-2xl font-semibold text-admin-text">Giden Mailler</h1>
        <div className="mt-8 rounded-lg border border-admin-border bg-admin-surface">
          <EmptyState icon={Send} title="Henüz kayıtlı mail yok" description="Müşterilere giden mailler gönderildikçe burada görünecek." />
        </div>
      </div>
    );
  }

  const where = {
    ...(q ? { to: { contains: q.trim(), mode: "insensitive" as const } } : {}),
    ...(tur && isEmailKind(tur) ? { kind: tur } : {}),
    ...(durum === "gonderildi" ? { sent: true } : durum === "hata" ? { sent: false } : {})
  };

  const [count, logs] = await Promise.all([
    prisma.emailLog.count({ where }),
    prisma.emailLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: { id: true, createdAt: true, to: true, kind: true, subject: true, sent: true }
    })
  ]);

  const rows: EmailLogRow[] = logs.map((log) => ({
    id: log.id,
    createdAtLabel: formatDateTime(log.createdAt, { dateStyle: "short", timeStyle: "short" }),
    to: log.to,
    kindLabel: isEmailKind(log.kind) ? emailKindLabel[log.kind] : log.kind,
    subject: log.subject,
    sent: log.sent
  }));

  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (tur) params.set("tur", tur);
  if (durum) params.set("durum", durum);
  const baseUrl = params.toString() ? `/admin/giden-mailler?${params.toString()}` : "/admin/giden-mailler";

  return (
    <div>
      <h1 className="text-2xl font-semibold text-admin-text">Giden Mailler</h1>
      <p className="mt-1 text-sm text-admin-text-muted">
        Müşterilere giden mailler. Kayıtlar {EMAIL_LOG_RETENTION_DAYS} gün saklanır, admin bildirimleri listelenmez.
      </p>

      <div className="mt-6">
        <EmailLogFilters />
      </div>

      <div className="mt-4">
        <EmailLogTable rows={rows} />
        <div className="mt-3 rounded-lg border border-admin-border bg-admin-surface empty:hidden">
          <Pagination page={page} totalPages={Math.max(1, Math.ceil(count / PAGE_SIZE))} baseUrl={baseUrl} />
        </div>
      </div>
    </div>
  );
}
