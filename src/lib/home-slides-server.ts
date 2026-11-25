import { prisma } from "@/lib/prisma";
import type { HomeSlide } from "@/generated/prisma/client";
import type { HomeSlideData, SlideAlign, SlideKind, SlideOverlay, SlideTone } from "@/lib/home-slides";

export function toSlideData(row: HomeSlide): HomeSlideData {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind as SlideKind,
    enabled: row.enabled,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt.toISOString(),
    startsAt: row.startsAt?.toISOString() ?? null,
    endsAt: row.endsAt?.toISOString() ?? null,
    desktopImageUrl: row.desktopImageUrl,
    mobileImageUrl: row.mobileImageUrl,
    desktopFocus: row.desktopFocus,
    mobileFocus: row.mobileFocus,
    altText: row.altText,
    href: row.href,
    eyebrow: row.eyebrow,
    title: row.title,
    subtitle: row.subtitle,
    buttonLabel: row.buttonLabel,
    textAlign: row.textAlign as SlideAlign,
    textTone: row.textTone as SlideTone,
    overlay: row.overlay as SlideOverlay,
    showCountdown: row.showCountdown
  };
}

// Anasayfa (ISR) icin: acik ve bitmemis slaytlar. Hangisinin su an gorunecegine
// tarayici dakika hassasiyetinde karar verir (home-hero.tsx) - sayfa 1 saat
// onbellekte kalsa da planlanan slayt zamaninda acilir, biten kapanir.
export async function getHomeSlides(): Promise<HomeSlideData[]> {
  const rows = await prisma.homeSlide.findMany({
    where: { enabled: true, OR: [{ endsAt: null }, { endsAt: { gte: new Date() } }] },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
  });
  return rows.map(toSlideData);
}
