"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/require-admin";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit-log";
import { getEfsaneSettings } from "@/lib/efsane-cuma-server";
import { formatDateTime } from "@/lib/format";

const PAGE = "/admin/efsane-cuma";

// datetime-local degeri Istanbul saati olarak okunur (Turkiye kalici UTC+3).
function istanbulInput(value: FormDataEntryValue | null): Date | null {
  const raw = String(value ?? "");
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(raw)) return null;
  const date = new Date(`${raw.length === 16 ? `${raw}:00` : raw}+03:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function saveEfsaneSettings(formData: FormData) {
  const session = await requireAdmin();
  const enabled = formData.get("enabled") === "on";
  const kalpPause = formData.get("kalpPause") === "on";
  const homeBand = formData.get("homeBand") === "on";
  const startsAt = istanbulInput(formData.get("startsAt"));
  // Bitis dakikasi sonuna kadar gecerli (23:59 -> 23:59:59).
  const endInput = istanbulInput(formData.get("endsAt"));
  const endsAt = endInput ? new Date(endInput.getTime() + 59_000) : null;
  if (!startsAt || !endsAt || endsAt <= startsAt) redirect(`${PAGE}?hata=tarih`);

  const before = await getEfsaneSettings();
  const updatedByEmail = session.user?.email ?? null;
  await prisma.efsaneCumaSettings.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", enabled, kalpPause, homeBand, startsAt, endsAt, updatedByEmail },
    update: { enabled, kalpPause, homeBand, startsAt, endsAt, updatedByEmail }
  });

  const onOff = (v: boolean) => (v ? "açık" : "kapalı");
  await logAudit({
    actorEmail: session.user?.email ?? "",
    actorRole: session.user?.role ?? "ADMIN",
    action: "EFSANE_CUMA_AYAR_DEGISTI",
    targetType: "EfsaneCumaSettings",
    targetId: "singleton",
    detail:
      `Kampanya ${onOff(before.enabled)} → ${onOff(enabled)}; Kalp Topla arası ${onOff(before.kalpPause)} → ${onOff(kalpPause)}; ` +
      `Anasayfa bandı ${onOff(before.homeBand)} → ${onOff(homeBand)}; ` +
      `${formatDateTime(startsAt)} – ${formatDateTime(endsAt)}`
  });

  // Pencere layout'ta (ISR) sayfalara gomulu: tum vitrin sayfalari tazelenir.
  revalidatePath("/", "layout");
  redirect(`${PAGE}?basarili=1`);
}
