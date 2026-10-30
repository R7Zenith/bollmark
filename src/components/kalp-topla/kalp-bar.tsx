"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Heart, Ticket } from "lucide-react";
import type { BarView } from "@/lib/kalp-topla/bar";
import { barMessage } from "@/lib/kalp-topla/messages";
import { CONSENT_TEXTS } from "@/lib/kalp-topla/consent-texts";
import { useKalpDurum } from "./use-kalp-durum";
import { KalpDialog } from "./kalp-dialog";
import { COUPON_SHAPE, KalpNasilCalisir } from "./kalp-nasil-calisir";
import { ArkadasiniCagir } from "./davet-paylas";

// Urun sayfasi Kalp Topla bari (KALP_TOPLA_PLANI.md 6.1). Gorunurluk
// istemcide oturuma gore cozulur; INVISIBLE ve FROZEN'da hic render edilmez.
// Esik 20'den buyukse kalp kutucuklari yerine duz bar gosterilir.
const MAX_CELLS = 20;

export function KalpBar({ productId }: { productId: string }) {
  const state = useKalpDurum();
  const [view, setView] = useState<BarView | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [popIndex, setPopIndex] = useState<number | null>(null);
  const [dialog, setDialog] = useState<"how" | "guest" | "first" | null>(null);
  const autoHeartTried = useRef(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/kalp-topla/bar?productId=${encodeURIComponent(productId)}`, { cache: "no-store" });
    const next = res.ok ? ((await res.json()) as BarView) : null;
    setView(next);
    return next;
  }, [productId]);

  useEffect(() => {
    if (state !== "ACTIVE") return;
    let alive = true;
    fetch(`/api/kalp-topla/bar?productId=${encodeURIComponent(productId)}`, { cache: "no-store" })
      .then(async (res) => (res.ok ? ((await res.json()) as BarView) : null))
      .then((next) => {
        if (alive) setView(next);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [state, productId]);

  const give = useCallback(async () => {
    setBusy(true);
    setError(null);
    setNotice(null);
    const before = view?.points ?? 0;
    try {
      const res = await fetch("/api/kalp-topla/kalp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Kalp verilemedi, tekrar dene.");
        await load();
        return;
      }
      const next = await load();
      if (data.status === "ACTIVE" && next && next.points > before) setPopIndex(next.points - 1);
      if (data.isFirstHeart && next && !next.emailConsent) setDialog("first");
    } catch {
      setError("Bağlantı sorunu, tekrar dene.");
    } finally {
      setBusy(false);
    }
  }, [productId, view?.points, load]);

  // Misafir uye olup/giris yapip geri donunce (?kalp=urunId) kalp otomatik verilir.
  useEffect(() => {
    if (!view?.loggedIn || autoHeartTried.current) return;
    const url = new URL(window.location.href);
    if (url.searchParams.get("kalp") !== productId) return;
    autoHeartTried.current = true;
    url.searchParams.delete("kalp");
    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
    if (!view.myHeart) void give();
  }, [view, productId, give]);

  const withdraw = async () => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/kalp-topla/kalp", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setError(typeof data.error === "string" ? data.error : "Kalp geri çekilemedi.");
      await load();
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    const res = await fetch("/api/kalp-topla/dogrulama", { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setNotice(
      data.result === "sent"
        ? "Doğrulama e-postası gönderildi."
        : data.result === "throttled"
          ? "Son 10 dakikada bir e-posta gönderdik, gelen kutunu kontrol et."
          : "E-postan doğrulanmış görünüyor, sayfayı yenile."
    );
  };

  if (state !== "ACTIVE" || !view) return null;

  const { points, threshold } = view;
  const message = barMessage({
    points,
    threshold,
    discountPercent: view.discountPercent,
    inviteBonus: view.inviteBonus,
    couponHours: view.couponHours,
    wonCoupon: Boolean(view.wonCouponExpiresAt),
    recentlyClosed: view.recentlyClosed
  });
  const quotaFull = !view.myHeart && view.used >= view.quota;
  const near = threshold - points <= 2 && points > 0;

  return (
    <section aria-label="Kalp Topla" className="mt-5 rounded-xl border border-sale/25 bg-[#FFF1F4] p-4 md:p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-xs font-medium text-sale">
            <Heart size={13} className="fill-sale" aria-hidden="true" />
            Kalp Topla
          </p>
          <p className="mt-1 text-[19px] font-semibold leading-tight tracking-[-0.4px] text-ink md:text-[21px]">
            {threshold} kalp dolsun, {view.discountPercent === 50 ? "yarı fiyatına al" : `%${view.discountPercent} indirimle al`}
          </p>
          <button
            type="button"
            onClick={() => setDialog("how")}
            className="mt-1.5 text-xs text-ink/60 underline underline-offset-4 hover:text-ink"
          >
            Nasıl çalışır?
          </button>
        </div>
        <svg viewBox="30 36 100 48" aria-hidden="true" className="w-[84px] shrink-0 -rotate-6 md:w-[96px]">
          <path d={COUPON_SHAPE} className="fill-[#FFC83D]" />
          <text x={80} y={71} textAnchor="middle" className="fill-ink text-[29px] font-bold">
            %{view.discountPercent}
          </text>
        </svg>
      </div>

      {view.closedRounds > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1">
          {view.lastClosedThreshold <= MAX_CELLS && (
            <span className="flex gap-0.5" aria-hidden="true">
              {Array.from({ length: view.lastClosedThreshold }, (_, i) => (
                <Heart key={i} size={16} className="fill-sale/30 text-sale/30" />
              ))}
            </span>
          )}
          <span className="text-xs text-ink/50">{view.closedRounds} kez doldu</span>
        </div>
      )}

      {threshold <= MAX_CELLS ? (
        <div
          className="mt-3 flex flex-wrap gap-1"
          role="meter"
          aria-valuemin={0}
          aria-valuemax={threshold}
          aria-valuenow={points}
          aria-label={`${points}/${threshold} kalp`}
        >
          {Array.from({ length: threshold }, (_, i) => (
            <Heart
              key={i}
              strokeWidth={1.6}
              aria-hidden="true"
              onAnimationEnd={() => setPopIndex(null)}
              className={`h-6 w-6 md:h-7 md:w-7 ${i < points ? "fill-sale text-sale" : "text-ink/25"} ${i === popIndex ? "animate-kalp-pop" : ""}`}
            />
          ))}
        </div>
      ) : (
        <div
          className="mt-3 h-2 overflow-hidden rounded-full bg-ink/10"
          role="meter"
          aria-valuemin={0}
          aria-valuemax={threshold}
          aria-valuenow={points}
          aria-label={`${points}/${threshold} kalp`}
        >
          <div className="h-full rounded-full bg-sale transition-[width] duration-500" style={{ width: `${(points / threshold) * 100}%` }} />
        </div>
      )}

      {view.wonCouponExpiresAt && points === 0 ? (
        <p className="mt-3 flex items-center gap-2 rounded-lg bg-[#FFC83D] px-3 py-2.5 text-sm font-semibold text-ink">
          <Ticket size={18} className="shrink-0" aria-hidden="true" />
          <span className="min-w-0 flex-1">{message}</span>
          <Link href="/hesap/kalplerim" className="shrink-0 text-xs font-medium underline underline-offset-4">
            Kuponu gör
          </Link>
        </p>
      ) : (
        <p className={`mt-2.5 text-sm ${near ? "font-medium text-sale" : "text-ink/80"}`}>{message}</p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
        {view.myHeart ? (
          <button
            type="button"
            onClick={withdraw}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-full border border-ink px-5 py-3 text-[11px] uppercase tracking-[1px] text-ink transition hover:bg-ink/5 disabled:opacity-50"
          >
            <Heart size={14} className="fill-sale text-sale" aria-hidden="true" />
            Kalbimi geri çek
          </button>
        ) : (
          <button
            type="button"
            onClick={() => (view.loggedIn ? give() : setDialog("guest"))}
            disabled={busy || quotaFull}
            className="inline-flex items-center gap-2 rounded-full bg-ink px-5 py-3 text-[11px] uppercase tracking-[1px] text-white transition hover:bg-ink/90 disabled:opacity-40"
          >
            <Heart size={14} aria-hidden="true" />
            Kalp ver
          </button>
        )}
        <ArkadasiniCagir
          productId={productId}
          loggedIn={view.loggedIn}
          inviteBonus={view.inviteBonus}
          onGuest={() => setDialog("guest")}
        />
        {view.loggedIn && (
          <span className="text-xs text-ink/50">
            Kalan kalp hakkın: {Math.max(view.quota - view.used, 0)}/{view.quota}
          </span>
        )}
      </div>

      {view.myHeart === "PENDING" && (
        <p className="mt-3 text-xs text-ink/70">
          E-postanı doğrula, kalbin sayılsın.{" "}
          <button type="button" onClick={resend} className="underline underline-offset-4 hover:text-ink">
            Tekrar gönder
          </button>
        </p>
      )}
      {quotaFull && (
        <p className="mt-3 text-xs text-ink/70">
          Aynı anda en fazla {view.quota} ürüne kalp verebilirsin.{" "}
          <Link href="/hesap/kalplerim" className="underline underline-offset-4 hover:text-ink">
            Kalplerim
          </Link>
          &apos;den birini geri çekerek yer açabilirsin.
        </p>
      )}
      {error && <p className="mt-3 text-xs text-sale">{error}</p>}
      {notice && <p className="mt-3 text-xs text-ink/70">{notice}</p>}

      <KalpDialog wide open={dialog === "how"} onClose={() => setDialog(null)} title="Kalp Topla nasıl çalışır?">
        <KalpNasilCalisir inviteBonus={view.inviteBonus} discountPercent={view.discountPercent} couponHours={view.couponHours} />
      </KalpDialog>

      <KalpDialog
        open={dialog === "guest"}
        onClose={() => setDialog(null)}
        title="Üye ol, bu ürünün indirimini birlikte açalım"
      >
        <p className="text-sm text-ink/70">
          Kalp vermek için üye olman gerekiyor. Üyeliğin bitince bu ürüne geri dönersin, kalbin verilmiş olur.
        </p>
        <div className="mt-5 flex flex-col gap-2">
          <a
            href={guestHref("kayit", productId)}
            className="rounded-full bg-ink px-6 py-3.5 text-center text-[11px] uppercase tracking-[1px] text-white hover:bg-ink/90"
          >
            Üye ol
          </a>
          <a
            href={guestHref("giris", productId)}
            className="rounded-full border border-ink px-6 py-3.5 text-center text-[11px] uppercase tracking-[1px] text-ink hover:bg-ink/5"
          >
            Zaten üyeyim, giriş yap
          </a>
        </div>
      </KalpDialog>

      <FirstHeartDialog open={dialog === "first"} onClose={() => setDialog(null)} onSaved={() => load()} />
    </section>
  );
}

function guestHref(tab: "kayit" | "giris", productId: string) {
  const callbackUrl = typeof window === "undefined" ? "/" : window.location.pathname;
  return `/hesap/giris?sekme=${tab}&callbackUrl=${encodeURIComponent(callbackUrl)}&kalp=${encodeURIComponent(productId)}`;
}

// Ilk kalp penceresi (plan 6.1, T3). Push bolumu Faz 8'de eklenir.
function FirstHeartDialog({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const [checked, setChecked] = useState(false);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (checked) {
      setSaving(true);
      await fetch("/api/kalp-topla/onay", { method: "POST" }).catch(() => undefined);
      setSaving(false);
      onSaved();
    }
    onClose();
  };

  return (
    <KalpDialog open={open} onClose={onClose} title="Bar dolunca sana haber verelim mi?">
      <label className="flex items-start gap-3 text-sm text-ink/80">
        <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0" />
        {CONSENT_TEXTS.EMAIL.text}
      </label>
      <div className="mt-6 flex gap-2">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="flex-1 rounded-full bg-ink px-6 py-3.5 text-[11px] uppercase tracking-[1px] text-white hover:bg-ink/90 disabled:opacity-50"
        >
          Kaydet
        </button>
        <button
          type="button"
          onClick={onClose}
          className="flex-1 rounded-full border border-ink px-6 py-3.5 text-[11px] uppercase tracking-[1px] text-ink hover:bg-ink/5"
        >
          Kapat
        </button>
      </div>
    </KalpDialog>
  );
}
