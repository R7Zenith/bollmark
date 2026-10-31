"use client";

import { useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Share2 } from "lucide-react";
import { inviteShareText, whatsappShareUrl } from "@/lib/kalp-topla/invite-rules";
import { KalpDialog } from "./kalp-dialog";
import { KalpDavetAnimasyon } from "./kalp-nasil-calisir";

const noSubscribe = () => () => undefined;
const buttonClass =
  "rounded-full border border-ink px-5 py-2.5 text-[11px] uppercase tracking-[1px] text-ink transition hover:bg-ink/5";

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

// Urun sayfasi "Arkadasini cagir" (plan 6.1): dokunmatik cihazda Web Share, masaustunde pencere.
export function ArkadasiniCagir({
  productId,
  loggedIn,
  inviteBonus,
  onGuest
}: {
  productId: string;
  loggedIn: boolean;
  inviteBonus: number;
  onGuest: () => void;
}) {
  const [path, setPath] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const invite = async () => {
    if (!loggedIn) return onGuest();
    setError(null);
    const res = await fetch(`/api/kalp-topla/davet?productId=${encodeURIComponent(productId)}`, { cache: "no-store" }).catch(() => null);
    const data = res?.ok ? ((await res.json()) as { path: string }) : null;
    if (!data) return setError("Davet linki alınamadı, tekrar dene.");
    setPath(data.path);
    const url = `${window.location.origin}${data.path}`;
    if (typeof navigator.share === "function" && window.matchMedia("(pointer: coarse)").matches) {
      try {
        await navigator.share({ text: inviteShareText(url) });
        return;
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
      }
    }
    setOpen(true);
  };

  return (
    <>
      <button type="button" onClick={invite} className="inline-flex items-center gap-2 text-xs font-medium text-ink underline underline-offset-4">
        <Share2 size={14} aria-hidden="true" />
        Arkadaşını çağır
      </button>
      {error && <p className="w-full text-xs text-sale">{error}</p>}
      <KalpDialog open={open} onClose={() => setOpen(false)} title="Arkadaşını çağır">
        <KalpDavetAnimasyon bonus={inviteBonus} />
        <p className="mb-4 mt-4 text-sm text-ink/70">
          Senin linkinle üye olan arkadaşın e-postasını doğrulayınca barına +{inviteBonus} kalp ekler.
        </p>
        {path && <DavetPaylasim path={path} />}
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
