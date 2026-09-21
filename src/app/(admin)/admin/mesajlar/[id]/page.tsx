import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { ArrowLeft, Mail } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-admin";
import { logAudit } from "@/lib/audit-log";
import {
  contactStatuses,
  contactStatusLabel,
  contactStatusTone,
  type ContactStatus
} from "@/lib/status";
import { Card } from "@/components/admin/card";
import { Badge } from "@/components/admin/badge";
import { Button } from "@/components/admin/button";
import { ConfirmSubmitButton } from "@/components/admin/confirm-submit-button";
import { MessageFeedback } from "@/components/admin/message-feedback";
import { MessageReadRefresh } from "@/components/admin/message-read-refresh";
import { formatDateTime } from "@/lib/format";

const selectClass =
  "rounded-md border border-admin-border bg-admin-surface px-3 py-2 text-sm text-admin-text focus:border-admin-accent focus:outline-none focus:ring-1 focus:ring-admin-accent";
const labelClass = "text-xs font-medium uppercase tracking-wide text-admin-text-muted";

async function updateStatusAction(id: string, formData: FormData) {
  "use server";
  const session = await requireAdmin();
  const statusRaw = String(formData.get("status") || "");
  if (!(contactStatuses as readonly string[]).includes(statusRaw)) {
    redirect(`/admin/mesajlar/${id}?hata=guncellenemedi`);
  }

  try {
    const before = await prisma.contactMessage.findUnique({ where: { id }, select: { status: true } });
    await prisma.contactMessage.update({ where: { id }, data: { status: statusRaw } });
    logAudit({
      actorEmail: session.user?.email ?? "bilinmiyor",
      actorRole: session.user?.role ?? "ADMIN",
      action: "CONTACT_MESSAGE_STATUS_CHANGED",
      targetType: "ContactMessage",
      targetId: id,
      detail: `${before?.status ?? "?"} -> ${statusRaw}`
    });
  } catch {
    redirect(`/admin/mesajlar/${id}?hata=guncellenemedi`);
  }
  // Sidebar rozeti (okunmamis sayisi) layout'ta hesaplanir.
  revalidatePath("/admin", "layout");
  redirect(`/admin/mesajlar/${id}?basarili=guncellendi`);
}

async function deleteMessageAction(id: string) {
  "use server";
  const session = await requireAdmin();
  try {
    const message = await prisma.contactMessage.delete({ where: { id } });
    logAudit({
      actorEmail: session.user?.email ?? "bilinmiyor",
      actorRole: session.user?.role ?? "ADMIN",
      action: "CONTACT_MESSAGE_DELETED",
      targetType: "ContactMessage",
      targetId: id,
      detail: `${message.firstName} ${message.lastName}`
    });
  } catch {
    redirect(`/admin/mesajlar/${id}?hata=silinemedi`);
  }
  revalidatePath("/admin", "layout");
  redirect("/admin/mesajlar?basarili=silindi");
}

export default async function AdminMessageDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ basarili?: string; hata?: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const { basarili, hata } = await searchParams;

  const message = await prisma.contactMessage.findUnique({ where: { id } });
  if (!message) notFound();

  // Detay acilinca "yeni" mesaj otomatik "okundu" olur (siparislerdeki viewedAt
  // ile ayni yaklasim, denetim kaydi yazilmaz - sadece elle yapilan degisiklikler
  // loglanir).
  const justMarkedRead = message.status === "YENI";
  if (justMarkedRead) {
    await prisma.contactMessage.update({ where: { id }, data: { status: "OKUNDU" } });
    message.status = "OKUNDU";
  }

  const fullName = `${message.firstName} ${message.lastName}`;
  const replyHref = `mailto:${message.email}?subject=${encodeURIComponent("Bollmark - Mesajınız hakkında")}`;

  return (
    <div className="max-w-3xl">
      <MessageFeedback basarili={basarili} hata={hata} />
      {justMarkedRead && <MessageReadRefresh />}

      <Link href="/admin/mesajlar" className="inline-flex items-center gap-1.5 text-sm text-admin-text-muted hover:text-admin-text">
        <ArrowLeft size={15} />
        Mesajlar
      </Link>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-admin-text">{fullName}</h1>
        <p className="text-sm text-admin-text-muted">
          {formatDateTime(message.createdAt, { dateStyle: "long", timeStyle: "short" })}
        </p>
      </div>

      <div className="mt-6 space-y-6">
        <Card
          title="Gönderen"
          action={
            <Badge tone={contactStatusTone[message.status as ContactStatus]}>
              {contactStatusLabel[message.status as ContactStatus] ?? message.status}
            </Badge>
          }
        >
          <dl className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className={labelClass}>Ad Soyad</dt>
              <dd className="mt-1 text-sm text-admin-text">{fullName}</dd>
            </div>
            <div>
              <dt className={labelClass}>E-posta</dt>
              <dd className="mt-1 break-all text-sm text-admin-text">{message.email}</dd>
            </div>
          </dl>
        </Card>

        <Card title="Mesaj">
          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-admin-text">{message.message}</p>
          <div className="mt-5">
            <a
              href={replyHref}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-admin-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
            >
              <Mail size={15} />
              E-posta ile yanıtla
            </a>
          </div>
        </Card>

        <Card title="Durum">
          <form action={updateStatusAction.bind(null, message.id)} className="flex flex-wrap items-center gap-3">
            <select name="status" defaultValue={message.status} className={selectClass}>
              {contactStatuses.map((s) => (
                <option key={s} value={s}>
                  {contactStatusLabel[s]}
                </option>
              ))}
            </select>
            <Button type="submit" variant="secondary">
              Durumu Kaydet
            </Button>
          </form>
        </Card>

        <Card title="Mesajı Sil">
          <form action={deleteMessageAction.bind(null, message.id)}>
            <ConfirmSubmitButton
              confirmMessage="Bu mesaj kalıcı olarak silinecek. Emin misiniz?"
              className="inline-flex items-center justify-center rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700"
            >
              Mesajı Sil
            </ConfirmSubmitButton>
          </form>
        </Card>
      </div>
    </div>
  );
}
