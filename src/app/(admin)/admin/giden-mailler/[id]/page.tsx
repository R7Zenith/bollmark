import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-admin";
import { formatDateTime } from "@/lib/format";
import { emailKindLabel, isEmailKind } from "@/lib/email/log";
import { Card } from "@/components/admin/card";
import { Badge } from "@/components/admin/badge";

const labelClass = "text-xs font-medium uppercase tracking-wide text-admin-text-muted";

export default async function AdminSentEmailDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const log = await prisma.emailLog.findUnique({ where: { id } });
  if (!log) notFound();

  return (
    <div className="max-w-4xl">
      <Link href="/admin/giden-mailler" className="inline-flex items-center gap-1.5 text-sm text-admin-text-muted hover:text-admin-text">
        <ArrowLeft size={15} />
        Giden Mailler
      </Link>

      <h1 className="mt-3 break-words text-2xl font-semibold text-admin-text">{log.subject}</h1>

      <div className="mt-6 space-y-6">
        <Card title="Gönderim" action={<Badge tone={log.sent ? "green" : "red"}>{log.sent ? "Gönderildi" : "Gönderilemedi"}</Badge>}>
          <dl className="grid gap-4 sm:grid-cols-3">
            <div>
              <dt className={labelClass}>Alıcı</dt>
              <dd className="mt-1 break-all text-sm text-admin-text">
                <Link href={`/admin/giden-mailler?q=${encodeURIComponent(log.to)}`} className="hover:underline">
                  {log.to}
                </Link>
              </dd>
            </div>
            <div>
              <dt className={labelClass}>Tür</dt>
              <dd className="mt-1 text-sm text-admin-text">{isEmailKind(log.kind) ? emailKindLabel[log.kind] : log.kind}</dd>
            </div>
            <div>
              <dt className={labelClass}>Tarih</dt>
              <dd className="mt-1 text-sm text-admin-text">{formatDateTime(log.createdAt, { dateStyle: "long", timeStyle: "short" })}</dd>
            </div>
          </dl>
          {log.error && (
            <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              <strong>Hata:</strong> {log.error}
            </p>
          )}
        </Card>

        <Card title="İçerik">
          {/* Musterinin gordugu HTML birebir; sandbox: betik calismaz, sayfaya erisemez. */}
          <iframe title="Mail içeriği" srcDoc={log.html} sandbox="" className="h-[900px] w-full rounded-md border border-admin-border bg-white" />
          {log.text && (
            <details className="mt-4">
              <summary className="cursor-pointer text-sm font-medium text-admin-text">Düz metin sürümü</summary>
              <pre className="mt-3 whitespace-pre-wrap break-words rounded-md bg-admin-bg p-4 text-xs leading-relaxed text-admin-text">{log.text}</pre>
            </details>
          )}
        </Card>
      </div>
    </div>
  );
}
