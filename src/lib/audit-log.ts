import { prisma } from "@/lib/prisma";

// order-notifications.ts ile ayni best-effort prensip - denetim kaydi
// yazilamamasi asil islemi asla engellemez, sadece loglanir.
export async function logAudit(params: {
  actorEmail: string;
  actorRole: string;
  action: string;
  targetType: string;
  targetId: string;
  detail?: string;
}) {
  await prisma.auditLog.create({ data: params }).catch((e) =>
    console.error("Denetim kaydı yazılamadı (yoksayıldı):", e)
  );
}
