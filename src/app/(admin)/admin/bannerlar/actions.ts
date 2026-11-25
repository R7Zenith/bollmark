"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/require-admin";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit-log";
import { deleteBlobUrls } from "@/lib/blob";
import { formatDateTime } from "@/lib/format";
import { isValidFocus, KALP_SLIDE_ID, moveInOrder, parseIstanbulInput } from "@/lib/home-slides";

const PAGE = "/admin/bannerlar";

type Session = Awaited<ReturnType<typeof requireAdmin>>;

async function audit(session: Session, action: string, targetId: string, detail: string) {
  await logAudit({
    actorEmail: session.user?.email ?? "",
    actorRole: session.user?.role ?? "ADMIN",
    action,
    targetType: "HomeSlide",
    targetId,
    detail
  });
}

const text = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();
const optional = (formData: FormData, key: string) => text(formData, key) || null;
const oneOf = <T extends string>(value: string, options: readonly T[], fallback: T): T =>
  (options as readonly string[]).includes(value) ? (value as T) : fallback;

export type SaveState = { error: string } | null;

export async function saveSlide(_prev: SaveState, formData: FormData): Promise<SaveState> {
  const session = await requireAdmin();
  const id = text(formData, "id") || null;
  const kind = oneOf(text(formData, "kind"), ["IMAGE_ONLY", "TEXT_OVERLAY"] as const, "IMAGE_ONLY");
  const name = text(formData, "name");
  const desktopImageUrl = text(formData, "desktopImageUrl");
  const mobileImageUrl = optional(formData, "mobileImageUrl");
  const altText = text(formData, "altText");
  const href = optional(formData, "href");
  const desktopFocus = text(formData, "desktopFocus") || "50% 50%";
  const mobileFocus = text(formData, "mobileFocus") || "50% 50%";
  const startRaw = text(formData, "startsAt");
  const endRaw = text(formData, "endsAt");
  const startsAt = startRaw ? parseIstanbulInput(startRaw) : null;
  // Bitis dakikasinin sonuna kadar gecerli (23:59 -> 23:59:59).
  const endInput = endRaw ? parseIstanbulInput(endRaw) : null;
  const endsAt = endInput ? new Date(endInput.getTime() + 59_000) : null;
  const overlay = text(formData, "overlay");
  const textFields = {
    eyebrow: kind === "TEXT_OVERLAY" ? optional(formData, "eyebrow") : null,
    title: kind === "TEXT_OVERLAY" ? optional(formData, "title") : null,
    subtitle: kind === "TEXT_OVERLAY" ? optional(formData, "subtitle") : null,
    buttonLabel: kind === "TEXT_OVERLAY" ? optional(formData, "buttonLabel") : null,
    textAlign: oneOf(text(formData, "textAlign"), ["LEFT", "CENTER"] as const, "LEFT"),
    textTone: oneOf(text(formData, "textTone"), ["LIGHT", "DARK"] as const, "LIGHT"),
    overlay: kind === "TEXT_OVERLAY" ? oneOf(overlay, ["NONE", "LIGHT", "MEDIUM"] as const, "NONE") : "NONE"
  };

  if (!name) return { error: "Banner adı boş olamaz." };
  if (!desktopImageUrl) return { error: "Masaüstü görseli yükleyin." };
  if (!altText) return { error: "Alt metni yazın: görme engelli ziyaretçiler ve Google görseli bu metinle tanır." };
  if (href && !href.startsWith("/") && !/^https:\/\//.test(href))
    return { error: "Bağlantı / ile (site içi) ya da https:// ile başlamalı." };
  if (!isValidFocus(desktopFocus) || !isValidFocus(mobileFocus)) return { error: "Odak noktası geçersiz." };
  if ((startRaw && !startsAt) || (endRaw && !endInput)) return { error: "Tarih geçersiz." };
  if (startsAt && endsAt && endsAt <= startsAt) return { error: "Bitiş tarihi başlangıçtan sonra olmalı." };
  if (kind === "TEXT_OVERLAY" && !textFields.title) return { error: "Başlığı yazın." };
  if (textFields.buttonLabel && !href) return { error: "Buton için bağlantı da girin." };

  const data = {
    name,
    kind,
    enabled: formData.get("enabled") === "on",
    startsAt,
    endsAt,
    desktopImageUrl,
    mobileImageUrl,
    desktopFocus,
    mobileFocus,
    altText,
    href,
    ...textFields,
    showCountdown: formData.get("showCountdown") === "on" && endsAt !== null,
    updatedByEmail: session.user?.email ?? null
  };

  const window = `${startsAt ? formatDateTime(startsAt) : "hemen"} – ${endsAt ? formatDateTime(endsAt) : "süresiz"}`;
  if (id) {
    const before = await prisma.homeSlide.findUnique({ where: { id } });
    if (!before || before.kind === "KALP_TOPLA") return { error: "Banner bulunamadı." };
    await prisma.homeSlide.update({ where: { id }, data });
    // Degisen gorselin eski dosyasi depodan silinir (R2 disi /public yollari atlanir).
    const kept = new Set([desktopImageUrl, mobileImageUrl]);
    await deleteBlobUrls([before.desktopImageUrl, before.mobileImageUrl ?? ""].filter((u) => u && !kept.has(u)));
    await audit(session, "ANASAYFA_BANNER_DEGISTI", id, `"${name}" düzenlendi; ${data.enabled ? "açık" : "kapalı"}, ${window}`);
  } else {
    const last = await prisma.homeSlide.aggregate({ _max: { sortOrder: true } });
    const created = await prisma.homeSlide.create({ data: { ...data, sortOrder: (last._max.sortOrder ?? 0) + 1 } });
    await audit(session, "ANASAYFA_BANNER_EKLENDI", created.id, `"${name}" eklendi; ${data.enabled ? "açık" : "kapalı"}, ${window}`);
  }

  revalidatePath("/");
  redirect(`${PAGE}?basarili=kaydedildi`);
}

export async function toggleSlide(id: string) {
  const session = await requireAdmin();
  const slide = await prisma.homeSlide.findUnique({ where: { id } });
  if (!slide) redirect(`${PAGE}?hata=bulunamadi`);
  await prisma.homeSlide.update({
    where: { id },
    data: { enabled: !slide.enabled, updatedByEmail: session.user?.email ?? null }
  });
  await audit(session, "ANASAYFA_BANNER_DEGISTI", id, `"${slide.name}" ${slide.enabled ? "kapatıldı" : "açıldı"}`);
  revalidatePath("/");
  redirect(`${PAGE}?basarili=${slide.enabled ? "kapatildi" : "acildi"}`);
}

// Liste sirasinda bir adim kaydirir; tum slaytlara 1..n sira yazilir.
export async function moveSlide(id: string, direction: "up" | "down") {
  const session = await requireAdmin();
  const slides = await prisma.homeSlide.findMany({
    select: { id: true, name: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
  });
  const ids = moveInOrder(
    slides.map((s) => s.id),
    id,
    direction
  );
  await prisma.$transaction(ids.map((slideId, i) => prisma.homeSlide.update({ where: { id: slideId }, data: { sortOrder: i + 1 } })));
  const name = slides.find((s) => s.id === id)?.name ?? id;
  await audit(session, "ANASAYFA_BANNER_DEGISTI", id, `"${name}" ${direction === "up" ? "yukarı" : "aşağı"} taşındı (sıra ${ids.indexOf(id) + 1})`);
  revalidatePath("/");
  redirect(PAGE);
}

export async function deleteSlide(id: string) {
  const session = await requireAdmin();
  if (id === KALP_SLIDE_ID) redirect(`${PAGE}?hata=sistem`);
  const slide = await prisma.homeSlide.findUnique({ where: { id } });
  if (!slide || slide.kind === "KALP_TOPLA") redirect(`${PAGE}?hata=bulunamadi`);
  await prisma.homeSlide.delete({ where: { id } });
  await deleteBlobUrls([slide.desktopImageUrl, slide.mobileImageUrl ?? ""].filter(Boolean));
  await audit(session, "ANASAYFA_BANNER_SILINDI", id, `"${slide.name}" silindi`);
  revalidatePath("/");
  redirect(`${PAGE}?basarili=silindi`);
}
