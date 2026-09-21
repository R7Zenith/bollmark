import Link from "next/link";
import { Mail } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-admin";
import { contactStatuses, contactStatusLabel, type ContactStatus } from "@/lib/status";
import { EmptyState } from "@/components/admin/empty-state";
import { MessagesTable, type MessageRow } from "@/components/admin/messages-table";
import { MessageFeedback } from "@/components/admin/message-feedback";
import { Pagination } from "@/components/admin/pagination";
import { formatDateTime } from "@/lib/format";

const PAGE_SIZE = 20;

interface SearchParams {
  durum?: string;
  page?: string;
  basarili?: string;
  hata?: string;
}

export default async function AdminMessagesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireAdmin();
  const { durum, page: pageParam, basarili, hata } = await searchParams;

  const activeStatus = (contactStatuses as readonly string[]).includes(durum ?? "") ? (durum as ContactStatus) : null;
  const page = Math.max(1, Number(pageParam) || 1);

  const [statusGroups, messages] = await Promise.all([
    prisma.contactMessage.groupBy({ by: ["status"], _count: true }),
    prisma.contactMessage.findMany({
      where: activeStatus ? { status: activeStatus } : {},
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE
    })
  ]);

  const counts: Record<string, number> = { tumu: 0 };
  for (const group of statusGroups) {
    counts[group.status] = group._count;
    counts.tumu += group._count;
  }

  if (counts.tumu === 0) {
    return (
      <div>
        <h1 className="text-2xl font-semibold text-admin-text">Mesajlar</h1>
        <div className="mt-8 rounded-lg border border-admin-border bg-admin-surface">
          <EmptyState icon={Mail} title="Henüz mesaj yok" description="İletişim formundan mesaj geldiğinde burada görünecek." />
        </div>
      </div>
    );
  }

  const rows: MessageRow[] = messages.map((m) => ({
    id: m.id,
    createdAtLabel: formatDateTime(m.createdAt, { dateStyle: "short", timeStyle: "short" }),
    fullName: `${m.firstName} ${m.lastName}`,
    email: m.email,
    firstLine: m.message.split("\n")[0],
    status: m.status
  }));

  const filteredCount = activeStatus ? (counts[activeStatus] ?? 0) : counts.tumu;
  const totalPages = Math.max(1, Math.ceil(filteredCount / PAGE_SIZE));
  const paginationBaseUrl = activeStatus ? `/admin/mesajlar?durum=${activeStatus}` : "/admin/mesajlar";

  const tabs: { value: ContactStatus | null; label: string; count: number }[] = [
    { value: null, label: "Tümü", count: counts.tumu },
    ...contactStatuses.map((s) => ({ value: s, label: contactStatusLabel[s], count: counts[s] ?? 0 }))
  ];

  return (
    <div>
      <h1 className="text-2xl font-semibold text-admin-text">Mesajlar</h1>

      <MessageFeedback basarili={basarili} hata={hata} />

      <div className="mt-6 flex items-center gap-1 overflow-x-auto border-b border-admin-border">
        {tabs.map((tab) => {
          const isActive = tab.value === activeStatus;
          return (
            <Link
              key={tab.label}
              href={tab.value ? `/admin/mesajlar?durum=${tab.value}` : "/admin/mesajlar"}
              className={`flex flex-shrink-0 items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? "border-admin-accent text-admin-text"
                  : "border-transparent text-admin-text-muted hover:text-admin-text"
              }`}
            >
              {tab.label}
              <span
                className={`rounded-full px-1.5 py-0.5 text-xs ${
                  isActive ? "bg-admin-accent/10 text-admin-accent" : "bg-admin-bg text-admin-text-muted"
                }`}
              >
                {tab.count}
              </span>
            </Link>
          );
        })}
      </div>

      <div className="mt-4">
        <MessagesTable messages={rows} />
        <div className="mt-3 rounded-lg border border-admin-border bg-admin-surface empty:hidden">
          <Pagination page={page} totalPages={totalPages} baseUrl={paginationBaseUrl} />
        </div>
      </div>
    </div>
  );
}
