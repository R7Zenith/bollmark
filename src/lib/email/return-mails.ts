import type { sendMail } from "@/lib/mail";
import { returnStatusNotifiable, type ReturnStatus } from "@/lib/status";
import { returnAdminNewEmail, returnReceivedEmail, type ReturnEmailData } from "./order-emails";

// Iade talebi mail kurallari (IADE_TALEBI_SISTEMI_PLANI.md 4.4). Prisma'ya
// dokunmaz: veriyi order-notifications.ts hazirlar, gonderici disaridan verilir
// (testte sahte sendMail).

type Send = typeof sendMail;

// 16 (musteri) + 17 (admin). Biri hata verse de digeri gider, hata yalniz loglanir:
// talep kaydi zaten olusmus olur, mail onu geri almaz.
export async function sendReturnCreatedMails(
  params: { customerEmail: string; data: ReturnEmailData; adminTo: string | null; adminUrl: string },
  send: Send
): Promise<void> {
  const { customerEmail, data, adminTo, adminUrl } = params;
  const results = await Promise.allSettled([
    send({ to: customerEmail, ...returnReceivedEmail(data), log: { kind: "RETURN_RECEIVED" } }),
    adminTo ? send({ to: adminTo, ...returnAdminNewEmail(data, adminUrl), log: { kind: "RETURN_ADMIN_NEW" } }) : Promise.resolve(false)
  ]);
  for (const result of results) {
    if (result.status === "rejected") console.error("İade talebi maili başarısız:", result.reason);
  }
}

// Admin kaydindan sonra hangi mail gider? Durum degisip mail atilan bir duruma
// gectiyse durum maili (yanit varsa icinde). Yoksa yeni/degisen yanit icin 18.
// Ikisi ayni kayitta olsa da tek mail gider.
export function pickReturnMail(
  before: { status: string; customerReply: string | null },
  after: { status: ReturnStatus; customerReply: string | null }
): "STATUS" | "REPLY" | null {
  if (after.status !== before.status && returnStatusNotifiable.includes(after.status)) return "STATUS";
  if (after.customerReply && after.customerReply !== before.customerReply) return "REPLY";
  return null;
}
