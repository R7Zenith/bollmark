import Link from "next/link";
import { ArrowDown, ArrowUp, Heart } from "lucide-react";
import { requireAdmin } from "@/lib/require-admin";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/format";
import { toSlideData } from "@/lib/home-slides-server";
import { SLIDE_KIND_LABEL, slideStatus, type SlideStatus } from "@/lib/home-slides";
import { Badge, type BadgeTone } from "@/components/admin/badge";
import { ConfirmSubmitButton } from "@/components/admin/confirm-submit-button";
import { deleteSlide, moveSlide, toggleSlide } from "./actions";

const STATUS: Record<SlideStatus, { label: string; tone: BadgeTone }> = {
  YAYINDA: { label: "Yayında", tone: "green" },
  PLANLANDI: { label: "Planlandı", tone: "blue" },
  SURESI_DOLDU: { label: "Süresi doldu", tone: "gray" },
  KAPALI: { label: "Kapalı", tone: "gray-muted" }
};

const FEEDBACK: Record<string, string> = {
  kaydedildi: "Banner kaydedildi. Anasayfa güncellendi.",
  acildi: "Banner açıldı.",
  kapatildi: "Banner kapatıldı.",
  silindi: "Banner silindi."
};
const ERRORS: Record<string, string> = {
  bulunamadi: "Banner bulunamadı; sayfayı yenileyip tekrar deneyin.",
  sistem: "Sistem slaytı silinemez; yalnız kapatılabilir."
};

const iconButton =
  "flex h-8 w-8 items-center justify-center rounded-md border border-admin-border text-admin-text-muted hover:border-admin-accent hover:text-admin-accent disabled:pointer-events-none disabled:opacity-30";

export default async function BannersPage({
  searchParams
}: {
  searchParams: Promise<{ basarili?: string; hata?: string }>;
}) {
  await requireAdmin();
  const { basarili, hata } = await searchParams;
  const rows = await prisma.homeSlide.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] });
  const slides = rows.map(toSlideData);
  const now = new Date().getTime();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Anasayfa Banner&apos;ları</h1>
          <p className="mt-1 max-w-2xl text-sm text-admin-text-muted">
            Anasayfanın en üstündeki tam ekran slaytlar, bu sırayla döner. Kapalı ya da tarih aralığı dışındaki slayt
            görünmez. Kaydedince anasayfa hemen güncellenir.
          </p>
        </div>
        <Link
          href="/admin/bannerlar/yeni"
          className="rounded-md bg-admin-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700"
        >
          Banner ekle
        </Link>
      </div>

      {basarili && FEEDBACK[basarili] && (
        <p className="rounded-md bg-green-50 px-4 py-3 text-sm text-green-800">{FEEDBACK[basarili]}</p>
      )}
      {hata && ERRORS[hata] && <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{ERRORS[hata]}</p>}

      {slides.length === 0 ? (
        <div className="rounded-lg border border-dashed border-admin-border bg-admin-surface px-6 py-12 text-center text-sm text-admin-text-muted">
          Henüz banner yok. Anasayfada hero görünmez; ilk banner&apos;ı ekleyin.
        </div>
      ) : (
        <ol className="divide-y divide-admin-border rounded-lg border border-admin-border bg-admin-surface">
          {slides.map((slide, i) => {
            const system = slide.kind === "KALP_TOPLA";
            const status = STATUS[slideStatus(slide, now)];
            return (
              <li key={slide.id} className="flex flex-wrap items-center gap-4 px-4 py-3">
                <div className="flex flex-col gap-1">
                  <form action={moveSlide.bind(null, slide.id, "up")}>
                    <button className={iconButton} disabled={i === 0} aria-label={`${slide.name}: yukarı taşı`}>
                      <ArrowUp size={14} />
                    </button>
                  </form>
                  <form action={moveSlide.bind(null, slide.id, "down")}>
                    <button
                      className={iconButton}
                      disabled={i === slides.length - 1}
                      aria-label={`${slide.name}: aşağı taşı`}
                    >
                      <ArrowDown size={14} />
                    </button>
                  </form>
                </div>

                <div className="relative h-[68px] w-[120px] shrink-0 overflow-hidden rounded-md border border-admin-border bg-gray-100">
                  {system ? (
                    <div className="flex h-full w-full items-center justify-center bg-rose-50 text-rose-400">
                      <Heart size={22} />
                    </div>
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={slide.desktopImageUrl}
                      alt=""
                      className="h-full w-full object-cover"
                      style={{ objectPosition: slide.desktopFocus }}
                    />
                  )}
                </div>

                <div className="min-w-[200px] flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-admin-text">{slide.name}</span>
                    <Badge tone={status.tone}>{status.label}</Badge>
                  </div>
                  <p className="mt-0.5 text-xs text-admin-text-muted">
                    {SLIDE_KIND_LABEL[slide.kind]}
                    {system
                      ? " · Kalp Topla yayındayken ve Muhteşem Kasım arası dışında görünür; içeriği kodda."
                      : ` · ${slide.startsAt ? formatDateTime(new Date(slide.startsAt)) : "Hemen"} – ${
                          slide.endsAt ? formatDateTime(new Date(slide.endsAt)) : "süresiz"
                        }`}
                  </p>
                </div>

                <form action={toggleSlide.bind(null, slide.id)}>
                  <button
                    role="switch"
                    aria-checked={slide.enabled}
                    aria-label={`${slide.name}: ${slide.enabled ? "kapat" : "aç"}`}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                      slide.enabled ? "bg-admin-accent" : "bg-gray-300"
                    }`}
                  >
                    <span
                      className={`inline-block h-5 w-5 rounded-full bg-white shadow transition ${
                        slide.enabled ? "translate-x-[22px]" : "translate-x-0.5"
                      }`}
                    />
                  </button>
                </form>

                <div className="flex items-center gap-3 text-sm">
                  {system ? (
                    <span className="w-[86px] text-xs text-admin-text-muted">Sistem slaytı</span>
                  ) : (
                    <>
                      <Link href={`/admin/bannerlar/${slide.id}`} className="text-admin-accent hover:underline">
                        Düzenle
                      </Link>
                      <form action={deleteSlide.bind(null, slide.id)}>
                        <ConfirmSubmitButton
                          confirmMessage={`"${slide.name}" silinsin mi? Görselleri de depodan silinir.`}
                          className="text-red-600 hover:underline"
                        >
                          Sil
                        </ConfirmSubmitButton>
                      </form>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
