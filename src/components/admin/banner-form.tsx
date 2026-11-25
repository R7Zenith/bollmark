"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { ImagePlus, Loader2 } from "lucide-react";
import { saveSlide } from "@/app/(admin)/admin/bannerlar/actions";
import { ACCEPTED_IMAGE_ACCEPT_ATTR, resizeImageForUpload } from "@/lib/client-image-resize";
import {
  FOCUS_PRESETS,
  parseIstanbulInput,
  toIstanbulInput,
  type HomeSlideData,
  type SlideAlign,
  type SlideKind,
  type SlideOverlay,
  type SlideTone
} from "@/lib/home-slides";
import { Card } from "@/components/admin/card";

// Anasayfa banner formu (bkz. ANASAYFA_BANNER_YONETIMI_PLANI.md). Sagda canli
// onizleme: slayt gercek olcude (1440x810 / 390x845) bir iframe'de
// (/banner-onizleme) gercek bilesenle cizilip kucultulur - boylece mobil
// duzen (md: kirilimi) admin ekraninin genisliginden bagimsiz dogru gorunur.

const inputClass =
  "mt-1 w-full rounded-md border border-admin-border px-3 py-2 text-sm focus:border-admin-accent focus:outline-none focus:ring-1 focus:ring-admin-accent";
const labelClass = "text-sm font-medium text-admin-text";
const hintClass = "mt-1 text-xs text-admin-text-muted";

const BANNER_MAX_EDGE = 2400;

type ImageSlot = "desktop" | "mobile";

function BannerImageField({
  label,
  hint,
  value,
  onChange
}: {
  label: string;
  hint: string;
  value: string;
  onChange: (url: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", await resizeImageForUpload(file, BANNER_MAX_EDGE));
      formData.append("profile", "banner");
      const res = await fetch("/api/admin/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) setError(data.error || "Yükleme başarısız oldu.");
      else onChange(data.url);
    } catch {
      setError("Yükleme başarısız oldu. Bağlantınızı kontrol edip tekrar deneyin.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div>
      <p className={labelClass}>{label}</p>
      <div className="mt-2 flex items-start gap-3">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="relative flex h-[72px] w-[128px] shrink-0 items-center justify-center overflow-hidden rounded-md border border-dashed border-admin-border bg-gray-50 text-admin-text-muted hover:border-admin-accent hover:text-admin-accent disabled:opacity-60"
          aria-label={value ? `${label}: değiştir` : `${label}: yükle`}
        >
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="" className="h-full w-full object-cover" />
          ) : uploading ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <ImagePlus size={18} />
          )}
        </button>
        <div className="min-w-0 text-xs">
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="text-admin-accent hover:underline disabled:opacity-50"
            >
              {uploading ? "Yükleniyor…" : value ? "Değiştir" : "Bilgisayardan yükle"}
            </button>
            {value && !uploading && (
              <button type="button" onClick={() => onChange("")} className="text-admin-text-muted hover:text-red-600">
                Kaldır
              </button>
            )}
          </div>
          <p className={hintClass}>{hint}</p>
          {error && <p className="mt-1 text-red-600">{error}</p>}
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_IMAGE_ACCEPT_ATTR}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) upload(file);
        }}
      />
    </div>
  );
}

const FOCUS_NAMES = ["Sol üst", "Üst", "Sağ üst", "Sol", "Orta", "Sağ", "Sol alt", "Alt", "Sağ alt"];

function FocusPicker({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const custom = !FOCUS_PRESETS.includes(value);
  return (
    <div>
      <p className={labelClass}>{label}</p>
      <div className="mt-2 flex items-center gap-3">
        <div className="grid w-[84px] grid-cols-3 gap-1 rounded-md border border-admin-border bg-gray-50 p-1" role="radiogroup" aria-label={label}>
          {FOCUS_PRESETS.map((preset, i) => (
            <button
              key={preset}
              type="button"
              role="radio"
              aria-checked={value === preset}
              aria-label={FOCUS_NAMES[i]}
              onClick={() => onChange(preset)}
              className={`h-6 rounded-sm ${value === preset ? "bg-admin-accent" : "bg-white hover:bg-indigo-100"}`}
            />
          ))}
        </div>
        <p className="text-xs text-admin-text-muted">
          {custom ? `Özel: ${value}` : FOCUS_NAMES[FOCUS_PRESETS.indexOf(value)]}
          <br />
          Ekran oranı farklıysa görselin bu tarafı korunur.
        </p>
      </div>
    </div>
  );
}

// Onizleme iframe'i: hazir oldugunu bildirince ve her degisiklikte slayti gonderir.
function PreviewFrame({
  frame,
  width,
  height,
  slide,
  guides,
  title
}: {
  frame: "desktop" | "mobile";
  width: number;
  height: number;
  slide: HomeSlideData;
  guides: boolean;
  title: string;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false);
  const [boxWidth, setBoxWidth] = useState(0);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin === window.location.origin && e.source === iframeRef.current?.contentWindow && e.data?.type === "banner-onizleme-hazir")
        setReady(true);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  useEffect(() => {
    if (ready)
      iframeRef.current?.contentWindow?.postMessage({ type: "banner-onizleme", slide, guides, frame }, window.location.origin);
  }, [ready, slide, guides, frame]);

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const observer = new ResizeObserver(([entry]) => setBoxWidth(entry.contentRect.width));
    observer.observe(box);
    return () => observer.disconnect();
  }, []);

  const scale = boxWidth / width;
  return (
    <figure>
      <div ref={boxRef} className="w-full">
        <div
          className="overflow-hidden rounded-md bg-gray-200 ring-1 ring-admin-border"
          style={{ height: boxWidth ? height * scale : undefined, aspectRatio: boxWidth ? undefined : `${width} / ${height}` }}
        >
          <iframe
            ref={iframeRef}
            src={`/banner-onizleme?cerceve=${frame}`}
            title={title}
            tabIndex={-1}
            width={width}
            height={height}
            style={{ transform: `scale(${scale || 0})`, transformOrigin: "0 0", border: 0 }}
          />
        </div>
      </div>
      <figcaption className="mt-1.5 text-xs text-admin-text-muted">
        {title} · {width}×{height}
      </figcaption>
    </figure>
  );
}

function Segmented<T extends string>({
  name,
  value,
  options,
  onChange
}: {
  name: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="mt-1 inline-flex rounded-md border border-admin-border bg-gray-50 p-0.5" role="radiogroup">
      {options.map((o) => (
        <label
          key={o.value}
          className={`cursor-pointer rounded px-3 py-1.5 text-sm ${
            value === o.value ? "bg-white font-medium text-admin-text shadow-sm" : "text-admin-text-muted hover:text-admin-text"
          }`}
        >
          <input
            type="radio"
            name={name}
            value={o.value}
            checked={value === o.value}
            onChange={() => onChange(o.value)}
            className="sr-only"
          />
          {o.label}
        </label>
      ))}
    </div>
  );
}

export function BannerForm({ slide }: { slide: HomeSlideData | null }) {
  const [state, formAction, pending] = useActionState(saveSlide, null);
  const [kind, setKind] = useState<SlideKind>(slide?.kind ?? "IMAGE_ONLY");
  const [name, setName] = useState(slide?.name ?? "");
  const [enabled, setEnabled] = useState(slide?.enabled ?? true);
  const [images, setImages] = useState({ desktop: slide?.desktopImageUrl ?? "", mobile: slide?.mobileImageUrl ?? "" });
  const [desktopFocus, setDesktopFocus] = useState(slide?.desktopFocus ?? "50% 50%");
  const [mobileFocus, setMobileFocus] = useState(slide?.mobileFocus ?? "50% 50%");
  const [altText, setAltText] = useState(slide?.altText ?? "");
  const [href, setHref] = useState(slide?.href ?? "");
  const [startsAt, setStartsAt] = useState(toIstanbulInput(slide?.startsAt ?? null));
  const [endsAt, setEndsAt] = useState(toIstanbulInput(slide?.endsAt ?? null));
  const [showCountdown, setShowCountdown] = useState(slide?.showCountdown ?? false);
  const [eyebrow, setEyebrow] = useState(slide?.eyebrow ?? "");
  const [title, setTitle] = useState(slide?.title ?? "");
  const [subtitle, setSubtitle] = useState(slide?.subtitle ?? "");
  const [buttonLabel, setButtonLabel] = useState(slide?.buttonLabel ?? "");
  const [textAlign, setTextAlign] = useState<SlideAlign>(slide?.textAlign ?? "LEFT");
  const [textTone, setTextTone] = useState<SlideTone>(slide?.textTone ?? "LIGHT");
  const [overlay, setOverlay] = useState<SlideOverlay>(slide?.overlay ?? "NONE");
  const [guides, setGuides] = useState(true);

  // Bu formda yuklenip kaydedilmeden degistirilen/kaldirilan gorsel depoda
  // kalmasin. Kayitli (eski) gorsel ise kaydedince sunucu siler.
  function setImage(slot: ImageSlot, url: string) {
    const previous = images[slot];
    const saved = slot === "desktop" ? slide?.desktopImageUrl : slide?.mobileImageUrl;
    if (previous && previous !== saved) {
      fetch("/api/admin/upload", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: previous })
      }).catch(() => {});
    }
    setImages((current) => ({ ...current, [slot]: url }));
  }

  const preview = useMemo<HomeSlideData>(() => {
    const end = parseIstanbulInput(endsAt);
    return {
      id: slide?.id ?? "yeni",
      name,
      kind,
      enabled,
      sortOrder: 0,
      createdAt: "",
      startsAt: null,
      endsAt: end ? new Date(end.getTime() + 59_000).toISOString() : null,
      desktopImageUrl: images.desktop,
      mobileImageUrl: images.mobile || null,
      desktopFocus,
      mobileFocus,
      altText,
      href: href || null,
      eyebrow: eyebrow || null,
      title: title || null,
      subtitle: subtitle || null,
      buttonLabel: buttonLabel || null,
      textAlign,
      textTone,
      overlay,
      showCountdown
    };
  }, [slide?.id, name, kind, enabled, endsAt, images, desktopFocus, mobileFocus, altText, href, eyebrow, title, subtitle, buttonLabel, textAlign, textTone, overlay, showCountdown]);

  const textOverlay = kind === "TEXT_OVERLAY";

  return (
    <form action={formAction} className="grid gap-6 xl:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <div className="space-y-6">
        {slide && <input type="hidden" name="id" value={slide.id} />}
        <input type="hidden" name="desktopImageUrl" value={images.desktop} />
        <input type="hidden" name="mobileImageUrl" value={images.mobile} />
        <input type="hidden" name="desktopFocus" value={desktopFocus} />
        <input type="hidden" name="mobileFocus" value={mobileFocus} />

        <Card title="Banner">
          <div className="space-y-5">
            <div>
              <label className={labelClass} htmlFor="name">
                Ad
              </label>
              <input id="name" name="name" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} required />
              <p className={hintClass}>Yalnız panelde görünür.</p>
            </div>
            <div>
              <p className={labelClass}>Tür</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {(
                  [
                    { value: "IMAGE_ONLY", label: "Yazılı görsel", text: "Yazı görselin içinde. Üstüne metin binmez, tüm slayt tıklanır." },
                    { value: "TEXT_OVERLAY", label: "Görsel + site yazısı", text: "Yazısız fotoğraf; etiket, başlık ve buton sitede yazılır." }
                  ] as const
                ).map((o) => (
                  <label
                    key={o.value}
                    className={`cursor-pointer rounded-md border p-3 text-sm ${
                      kind === o.value ? "border-admin-accent bg-indigo-50/60 ring-1 ring-admin-accent" : "border-admin-border hover:border-gray-400"
                    }`}
                  >
                    <input type="radio" name="kind" value={o.value} checked={kind === o.value} onChange={() => setKind(o.value)} className="sr-only" />
                    <span className="font-medium text-admin-text">{o.label}</span>
                    <span className="mt-1 block text-xs text-admin-text-muted">{o.text}</span>
                  </label>
                ))}
              </div>
            </div>
            <label className="flex items-center gap-3 text-sm">
              <input type="checkbox" name="enabled" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="h-4 w-4" />
              Açık (kapalıyken tarih aralığında da görünmez)
            </label>
          </div>
        </Card>

        <Card title="Görseller">
          <div className="space-y-6">
            <div className="grid gap-6 sm:grid-cols-2">
              <BannerImageField
                label="Masaüstü görseli"
                hint="Önerilen 2400×1350 (16:9). Zorunlu."
                value={images.desktop}
                onChange={(url) => setImage("desktop", url)}
              />
              <BannerImageField
                label="Mobil görsel"
                hint="Önerilen 1080×1920 (9:16). Boşsa masaüstü görseli kullanılır."
                value={images.mobile}
                onChange={(url) => setImage("mobile", url)}
              />
            </div>
            <div className="grid gap-6 sm:grid-cols-2">
              <FocusPicker label="Masaüstü odak noktası" value={desktopFocus} onChange={setDesktopFocus} />
              <FocusPicker label="Mobil odak noktası" value={mobileFocus} onChange={setMobileFocus} />
            </div>
            <div>
              <label className={labelClass} htmlFor="altText">
                Alt metin
              </label>
              <input id="altText" name="altText" value={altText} onChange={(e) => setAltText(e.target.value)} className={inputClass} required />
              <p className={hintClass}>
                {textOverlay
                  ? "Fotoğrafta ne görünüyor? Örn. “Akşam şehirde yürüyen, alışveriş poşetli bir çift”."
                  : "Görseldeki yazıyı ve teklifi yazın; ekran okuyucu bunu okur."}
              </p>
            </div>
          </div>
        </Card>

        {textOverlay && (
          <Card title="Site yazısı">
            <div className="space-y-4">
              <div>
                <label className={labelClass} htmlFor="eyebrow">
                  Etiket
                </label>
                <input id="eyebrow" name="eyebrow" value={eyebrow} onChange={(e) => setEyebrow(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass} htmlFor="title">
                  Başlık
                </label>
                <input id="title" name="title" value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} required />
              </div>
              <div>
                <label className={labelClass} htmlFor="subtitle">
                  Açıklama
                </label>
                <input id="subtitle" name="subtitle" value={subtitle} onChange={(e) => setSubtitle(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass} htmlFor="buttonLabel">
                  Buton yazısı
                </label>
                <input id="buttonLabel" name="buttonLabel" value={buttonLabel} onChange={(e) => setButtonLabel(e.target.value)} className={inputClass} />
                <p className={hintClass}>Boşsa buton görünmez.</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <p className={labelClass}>Hizalama</p>
                  <Segmented
                    name="textAlign"
                    value={textAlign}
                    onChange={setTextAlign}
                    options={[
                      { value: "LEFT", label: "Sol" },
                      { value: "CENTER", label: "Orta" }
                    ]}
                  />
                </div>
                <div>
                  <p className={labelClass}>Metin rengi</p>
                  <Segmented
                    name="textTone"
                    value={textTone}
                    onChange={(tone) => {
                      setTextTone(tone);
                      if (tone === "DARK") setOverlay("NONE");
                    }}
                    options={[
                      { value: "LIGHT", label: "Beyaz" },
                      { value: "DARK", label: "Siyah" }
                    ]}
                  />
                </div>
                <div>
                  <p className={labelClass}>Karartma</p>
                  <Segmented
                    name="overlay"
                    value={overlay}
                    onChange={setOverlay}
                    options={[
                      { value: "NONE", label: "Yok" },
                      { value: "LIGHT", label: "Hafif" },
                      { value: "MEDIUM", label: "Orta" }
                    ]}
                  />
                </div>
              </div>
              <p className={hintClass}>Beyaz yazı koyu görsele, siyah yazı (siyah butonla) açık görsele uyar.</p>
            </div>
          </Card>
        )}

        <Card title="Bağlantı ve yayın tarihleri">
          <div className="space-y-4">
            <div>
              <label className={labelClass} htmlFor="href">
                Bağlantı
              </label>
              <input id="href" name="href" value={href} onChange={(e) => setHref(e.target.value)} placeholder="/urunler" className={inputClass} />
              <p className={hintClass}>
                {textOverlay ? "Butonun açacağı sayfa." : "Slayta tıklayınca açılacak sayfa."} Site içi için / ile başlayın.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass} htmlFor="startsAt">
                  Başlangıç
                </label>
                <input id="startsAt" name="startsAt" type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className={inputClass} />
                <p className={hintClass}>İstanbul saati. Boşsa hemen.</p>
              </div>
              <div>
                <label className={labelClass} htmlFor="endsAt">
                  Bitiş
                </label>
                <input
                  id="endsAt"
                  name="endsAt"
                  type="datetime-local"
                  value={endsAt}
                  onChange={(e) => {
                    setEndsAt(e.target.value);
                    if (!e.target.value) setShowCountdown(false);
                  }}
                  className={inputClass}
                />
                <p className={hintClass}>İstanbul saati, dakikanın sonuna kadar. Boşsa süresiz.</p>
              </div>
            </div>
            {textOverlay && (
              <label className={`flex items-center gap-3 text-sm ${endsAt ? "" : "opacity-50"}`}>
                <input
                  type="checkbox"
                  name="showCountdown"
                  checked={showCountdown}
                  disabled={!endsAt}
                  onChange={(e) => setShowCountdown(e.target.checked)}
                  className="h-4 w-4"
                />
                Bitiş tarihine geri sayım göster
              </label>
            )}
          </div>
        </Card>

        <div className="flex flex-wrap items-center gap-4">
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-admin-accent px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {pending ? "Kaydediliyor…" : "Kaydet"}
          </button>
          {state?.error && (
            <p role="alert" className="text-sm text-red-600">
              {state.error}
            </p>
          )}
        </div>
      </div>

      <div className="xl:sticky xl:top-6 xl:self-start">
        <Card
          title="Önizleme"
          action={
            <label className="flex items-center gap-2 text-xs text-admin-text-muted">
              <input type="checkbox" checked={guides} onChange={(e) => setGuides(e.target.checked)} className="h-3.5 w-3.5" />
              Menü, noktalar ve güvenli alan
            </label>
          }
        >
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,0.3fr)] items-start gap-4">
            <PreviewFrame frame="desktop" width={1440} height={810} slide={preview} guides={guides} title="Masaüstü" />
            <PreviewFrame frame="mobile" width={390} height={845} slide={preview} guides={guides} title="Telefon" />
          </div>
          <p className="mt-3 text-xs text-admin-text-muted">
            Kesikli çizginin içi güvenli alandır: yazı, yüzde işareti ve ürünler burada kalmalı. Gölgeli bantlar menünün ve slayt
            noktalarının altında kalan yerlerdir.
          </p>
        </Card>
      </div>
    </form>
  );
}
