"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/require-admin";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit-log";
import { getKalpSettings, type KalpMode } from "@/lib/kalp-topla/settings";

const PAGE = "/admin/kalp-topla";
const MODES: KalpMode[] = ["OFF", "HIDDEN", "LIVE"];
const MODE_LABEL: Record<KalpMode, string> = { OFF: "Kapalı", HIDDEN: "Gizli yayın", LIVE: "Açık" };

// Sayisal ayarlar ve islem gecmisindeki adlari. testThreshold yalniz gizli
// yayin modunda formda gorunur; formda yoksa mevcut deger korunur.
const NUMBER_FIELDS = {
  threshold: "Eşik",
  testThreshold: "Test eşiği",
  discountPercent: "İndirim oranı (%)",
  couponHours: "Kupon süresi (saat)",
  heartQuota: "Kalp hakkı",
  inviteBonus: "Davet bonusu",
  refundExtraHours: "İade sonrası ek süre (saat)",
  sameDeviceMaxAccounts: "Aynı cihazdan otomatik sayılan hesap",
  sameIpWindowHours: "Aynı IP penceresi (saat)",
  sameIpMinAccounts: "Aynı IP işareti için hesap sayısı"
} as const;
type NumberField = keyof typeof NUMBER_FIELDS;

function actor(session: Awaited<ReturnType<typeof requireAdmin>>) {
  return { actorEmail: session.user?.email ?? "", actorRole: session.user?.role ?? "ADMIN" };
}

async function upsertSettings(data: Parameters<typeof prisma.kalpToplaSettings.update>[0]["data"]) {
  await prisma.kalpToplaSettings.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", ...(data as object) },
    update: data
  });
}

export async function saveKalpMode(formData: FormData) {
  const session = await requireAdmin();
  const mode = String(formData.get("mode") ?? "") as KalpMode;
  if (!MODES.includes(mode)) redirect(`${PAGE}?hata=mod`);

  const current = await getKalpSettings();
  if (current.mode !== mode) {
    await upsertSettings({ mode });
    await logAudit({
      ...actor(session),
      action: "KALP_TOPLA_MOD_DEGISTI",
      targetType: "KalpToplaSettings",
      targetId: "singleton",
      detail: `${MODE_LABEL[current.mode as KalpMode] ?? current.mode} → ${MODE_LABEL[mode]}`
    });
  }
  revalidatePath(PAGE);
  redirect(`${PAGE}?basarili=mod`);
}

export async function saveKalpValues(formData: FormData) {
  const session = await requireAdmin();
  const current = await getKalpSettings();

  const data: Partial<Record<NumberField, number>> = {};
  const changes: string[] = [];
  for (const field of Object.keys(NUMBER_FIELDS) as NumberField[]) {
    const raw = formData.get(field);
    if (raw === null) continue;
    const value = Number(String(raw).trim());
    if (!Number.isInteger(value) || value < 1 || (field === "discountPercent" && value > 100)) {
      redirect(`${PAGE}?hata=deger`);
    }
    if (value !== current[field]) {
      data[field] = value;
      changes.push(`${NUMBER_FIELDS[field]}: ${current[field]} → ${value}`);
    }
  }

  if (changes.length > 0) {
    await upsertSettings(data);
    await logAudit({
      ...actor(session),
      action: "KALP_TOPLA_AYAR_DEGISTI",
      targetType: "KalpToplaSettings",
      targetId: "singleton",
      detail: changes.join(", ")
    });
  }
  revalidatePath(PAGE);
  redirect(`${PAGE}?basarili=degerler`);
}

export async function addKalpTester(formData: FormData) {
  const session = await requireAdmin();
  const email = String(formData.get("email") ?? "").trim();
  if (!email) redirect(`${PAGE}?hata=eposta`);

  const customer = await prisma.customer.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { id: true, email: true }
  });
  if (!customer) redirect(`${PAGE}?hata=musteri-yok`);

  const current = await getKalpSettings();
  if (!current.testerCustomerIds.includes(customer.id)) {
    await upsertSettings({ testerCustomerIds: [...current.testerCustomerIds, customer.id] });
    await logAudit({
      ...actor(session),
      action: "KALP_TOPLA_AYAR_DEGISTI",
      targetType: "KalpToplaSettings",
      targetId: "singleton",
      detail: `Test hesabı eklendi: ${customer.email}`
    });
  }
  revalidatePath(PAGE);
  redirect(`${PAGE}?basarili=test-eklendi`);
}

export async function removeKalpTester(formData: FormData) {
  const session = await requireAdmin();
  const customerId = String(formData.get("customerId") ?? "");
  const current = await getKalpSettings();
  if (current.testerCustomerIds.includes(customerId)) {
    const customer = await prisma.customer.findUnique({ where: { id: customerId }, select: { email: true } });
    await upsertSettings({ testerCustomerIds: current.testerCustomerIds.filter((id) => id !== customerId) });
    await logAudit({
      ...actor(session),
      action: "KALP_TOPLA_AYAR_DEGISTI",
      targetType: "KalpToplaSettings",
      targetId: "singleton",
      detail: `Test hesabı çıkarıldı: ${customer?.email ?? customerId}`
    });
  }
  revalidatePath(PAGE);
  redirect(`${PAGE}?basarili=test-cikarildi`);
}

// "@ornek.com", "https://ornek.com" gibi girisleri sade alan adina cevirir.
function normalizeDomain(input: string): string | null {
  const domain = input.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^@/, "").replace(/\/.*$/, "");
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(domain) ? domain : null;
}

export async function addBlockedDomain(formData: FormData) {
  const session = await requireAdmin();
  const domain = normalizeDomain(String(formData.get("domain") ?? ""));
  if (!domain) redirect(`${PAGE}?hata=alan-adi`);

  const existing = await prisma.blockedEmailDomain.findUnique({ where: { domain } });
  if (!existing) {
    const row = await prisma.blockedEmailDomain.create({
      data: { domain, createdByEmail: session.user?.email ?? "" }
    });
    await logAudit({
      ...actor(session),
      action: "KALP_TOPLA_ALAN_ADI_ENGELLENDI",
      targetType: "BlockedEmailDomain",
      targetId: row.id,
      detail: domain
    });
  }
  revalidatePath(PAGE);
  redirect(`${PAGE}?basarili=alan-adi-eklendi`);
}

export async function removeBlockedDomain(formData: FormData) {
  const session = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const row = await prisma.blockedEmailDomain.findUnique({ where: { id } });
  if (row) {
    await prisma.blockedEmailDomain.delete({ where: { id } });
    await logAudit({
      ...actor(session),
      action: "KALP_TOPLA_ALAN_ADI_KALDIRILDI",
      targetType: "BlockedEmailDomain",
      targetId: id,
      detail: row.domain
    });
  }
  revalidatePath(PAGE);
  redirect(`${PAGE}?basarili=alan-adi-kaldirildi`);
}
