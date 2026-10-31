"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Share2 } from "lucide-react";
import { inviteBonusStep, inviteShareText, whatsappShareUrl } from "@/lib/kalp-topla/invite-rules";
import { KalpDialog } from "./kalp-dialog";
import { KalpDavetAnimasyon } from "./kalp-nasil-calisir";

const noSubscribe = () => () => undefined;
const COPIED_MS = 2500;
const buttonClass =
  "rounded-full border border-ink px-5 py-2.5 text-[11px] uppercase tracking-[1px] text-ink transition hover:bg-ink/5";
const channelClass =
  "rounded-full border border-ink px-4 py-3.5 text-center text-[11px] uppercase tracking-[1px] text-ink transition hover:bg-ink/5";

// Kopyala + WhatsApp (plan 6.4). WhatsApp yalniz resmi wa.me paylasim linkidir.
export function DavetPaylasim({ path }: { path: string }) {
  const origin = useSyncExternalStore(noSubscribe, () => window.location.origin, () => "");
  const [copied, setCopied] = useState(false);
  const url = `${origin}${path}`;

  const copy = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
  };

  return (
    <div>
      <input
        readOnly
        value={url}
        aria-label="Davet linkin"
        onFocus={(e) => e.currentTarget.select()}
        className="w-full rounded-lg border border-line bg-transparent px-4 py-3 text-xs text-ink"
      />
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={copy} className={buttonClass}>
          {copied ? "Kopyalandı" : "Linki kopyala"}
        </button>
        <a href={whatsappShareUrl(url)} target="_blank" rel="noopener noreferrer" className={buttonClass}>
          WhatsApp&apos;ta paylaş
        </a>
      </div>
    </div>
  );
}

// Urun sayfasi davet kutusunun kanallari: WhatsApp, kopyala, varsa telefonun paylasim menusu.
function DavetKanallari({ path }: { path: string }) {
  const origin = useSyncExternalStore(noSubscribe, () => window.location.origin, () => "");
  const canShare = useSyncExternalStore(noSubscribe, () => typeof navigator.share === "function", () => false);
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const url = `${origin}${path}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), COPIED_MS);
    } catch {
      // Pano izni yoksa link secili kalir, elle kopyalanabilir.
      inputRef.current?.select();
    }
  };

  // Kullanici menuyu kapatirsa (AbortError) kutu acik kalir, yapilacak bir sey yok.
  const share = () => navigator.share({ text: inviteShareText(url) }).catch(() => undefined);

  return (
    <div className="mt-4">
      <input
        ref={inputRef}
        readOnly
        value={url}
        aria-label="Davet linkin"
        onFocus={(e) => e.currentTarget.select()}
        className="w-full truncate rounded-lg border border-line bg-transparent px-4 py-3 text-xs text-ink"
      />
      <a
        href={whatsappShareUrl(url)}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 block rounded-full bg-ink px-6 py-3.5 text-center text-[11px] uppercase tracking-[1px] text-white hover:bg-ink/90"
      >
        WhatsApp&apos;ta gönder
      </a>
      <div className="mt-2 flex gap-2">
        <button type="button" onClick={copy} aria-live="polite" className={`flex-1 ${channelClass}`}>
          {copied ? "Kopyalandı ✓" : "Linki kopyala"}
        </button>
        {canShare && (
          <button type="button" onClick={share} className={`flex-1 ${channelClass}`}>
            Diğer
          </button>
        )}
      </div>
    </div>
  );
}

// Urun sayfasi "Arkadasini cagir" (plan 6.1): once ne olacagini anlatan kutu acilir.
export function ArkadasiniCagir({
  productId,
  loggedIn,
  inviteBonus,
  activeHeartHere,
  onGuest
}: {
  productId: string;
  loggedIn: boolean;
  inviteBonus: number;
  activeHeartHere: boolean;
  onGuest: () => void;
}) {
  const [path, setPath] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const steps = [
    "Davet linkini arkadaşına gönder.",
    "Arkadaşın linkle üye olur ve e-postasını doğrular.",
    inviteBonusStep(inviteBonus, activeHeartHere)
  ];

  const invite = async () => {
    if (!loggedIn) return onGuest();
    setError(null);
    const res = await fetch(`/api/kalp-topla/davet?productId=${encodeURIComponent(productId)}`, { cache: "no-store" }).catch(() => null);
    const data = res?.ok ? ((await res.json()) as { path: string }) : null;
    if (!data) return setError("Davet linki alınamadı, tekrar dene.");
    setPath(data.path);
    setOpen(true);
  };

  return (
    <>
      <button type="button" onClick={invite} className="inline-flex items-center gap-2 text-xs font-medium text-ink underline underline-offset-4">
        <Share2 size={14} aria-hidden="true" />
        Arkadaşını çağır
      </button>
      {error && <p className="w-full text-xs text-sale">{error}</p>}
      <KalpDialog open={open} onClose={() => setOpen(false)} title="Arkadaşını çağır, kalpler hızlansın">
        <KalpDavetAnimasyon bonus={inviteBonus} />
        <ol className="mt-4 space-y-2 text-sm text-ink/70">
          {steps.map((step, i) => (
            <li key={step} className="flex gap-2.5">
              <span className="font-medium text-ink">{i + 1}.</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
        {path && <DavetKanallari path={path} />}
      </KalpDialog>
    </>
  );
}

// Kalplerim: genel linkte +2'nin gidecegi urun (plan 6.4).
export function DavetHedefSecici({
  options,
  value,
  inviteBonus
}: {
  options: { productId: string; name: string }[];
  value: string | null;
  inviteBonus: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const change = async (productId: string) => {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/kalp-topla/davet", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId: productId || null })
    }).catch(() => null);
    if (!res?.ok) setError("Seçim kaydedilemedi, tekrar dene.");
    setBusy(false);
    router.refresh();
  };

  return (
    <label className="block text-xs text-ink/70">
      +{inviteBonus} bu ürüne gitsin
      <select
        value={value ?? ""}
        disabled={busy}
        onChange={(e) => change(e.target.value)}
        className="mt-1.5 block w-full rounded-lg border border-line bg-transparent px-3 py-2.5 text-sm text-ink"
      >
        <option value="">Otomatik: dolmaya en yakın barım</option>
        {options.map((o) => (
          <option key={o.productId} value={o.productId}>
            {o.name}
          </option>
        ))}
      </select>
      {error && <span className="mt-1 block text-sale">{error}</span>}
    </label>
  );
}
