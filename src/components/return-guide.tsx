"use client";

import { useState } from "react";
import { STORE_INFO } from "@/lib/store-info";
import type { ReturnGuideData } from "@/lib/return-guide";

// Iade rehberi parcalari: hesap > Iade Taleplerim ve /siparis-durumu ayni
// bilesenleri kullanir. Kod ve adres prop olarak gelir (sunucu yalniz
// ONAYLANDI/KARGODA talepte verir); bu dosya RETURN_INFO'yu import etmez.

function CopyButton({ value, label }: { value: string; label: string }) {
  const [state, setState] = useState<"idle" | "done" | "failed">("idle");

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setState("done");
    } catch {
      setState("failed");
    }
    window.setTimeout(() => setState("idle"), 2200);
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="mt-3 inline-flex min-h-11 items-center rounded-full border border-ink px-5 text-[10px] uppercase tracking-[1px] text-ink transition-colors hover:bg-ink hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
    >
      <span aria-live="polite">{state === "done" ? "Kopyalandı" : state === "failed" ? "Kopyalanamadı, elle seçin" : label}</span>
    </button>
  );
}

export function ReturnGuide({ guide }: { guide: ReturnGuideData }) {
  return (
    <section aria-labelledby="iade-rehber" className="mt-5 border border-ink">
      <h3 id="iade-rehber" className="px-5 pt-5 font-display text-lg sm:px-6">
        Ürünü nasıl gönderirim?
      </h3>

      {/* Kargo fisi: subeye gidince lazim olan iki bilgi, kopyalanabilir. */}
      <div className="mx-5 mt-4 grid border border-dashed border-ink/40 bg-ink/[0.024] sm:mx-6 sm:grid-cols-2">
        <div className="p-4 sm:border-r sm:border-dashed sm:border-ink/40">
          <p className="text-xs text-ink/60">{guide.carrier} anlaşmalı iade kodu</p>
          <p className="mt-1 select-all font-display text-[28px] leading-none tracking-[0.06em] tabular-nums">{guide.code}</p>
          <p className="mt-2 text-xs text-ink/60">Şubede görevliye bu kodu söyle, gönderim ücretsiz.</p>
          <CopyButton value={guide.code} label="Kodu kopyala" />
        </div>
        <div className="border-t border-dashed border-ink/40 p-4 sm:border-t-0">
          <p className="text-xs text-ink/60">Alıcı ve adres</p>
          <p className="mt-1 select-all text-sm leading-relaxed">
            {guide.recipient}
            <br />
            {guide.address}
          </p>
          <CopyButton value={guide.address} label="Adresi kopyala" />
        </div>
      </div>

      <ol className="mt-5 space-y-2 px-5 text-sm leading-relaxed sm:px-6">
        {guide.steps.map((step, i) => (
          <li key={step} className="flex gap-3">
            <span aria-hidden="true" className="w-4 shrink-0 tabular-nums text-ink/50">
              {i + 1}.
            </span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
      <p className="mt-4 border-t border-line px-5 py-4 text-xs leading-relaxed text-ink/60 sm:px-6">
        {guide.warning} Ürün bize ulaşıp kontrol edildikten sonra iade bedeli en geç {STORE_INFO.returnDays} gün içinde ödeme
        yöntemine yapılır; değişimde yeni ürünün kargolanır.
      </p>
    </section>
  );
}

const STEPS = [
  { status: "TALEP_EDILDI", label: "Talep edildi" },
  { status: "ONAYLANDI", label: "Onaylandı" },
  { status: "KARGODA", label: "Kargoda" },
  { status: "TAMAMLANDI", label: "Tamamlandı" }
];

export function ReturnSteps({ status }: { status: string }) {
  if (status === "REDDEDILDI") {
    return <p className="mt-4 text-sm text-ink/70">Bu talep onaylanmadı.</p>;
  }
  const active = Math.max(0, STEPS.findIndex((s) => s.status === status));
  return (
    <ol className="mt-5 grid grid-cols-4" aria-label="Talep durumu">
      {STEPS.map((step, i) => {
        const done = i <= active;
        return (
          <li key={step.status} className="relative flex flex-col items-center text-center" aria-current={i === active ? "step" : undefined}>
            {i > 0 && <span aria-hidden="true" className={`absolute right-1/2 top-[11px] h-px w-full ${done ? "bg-ink" : "bg-line"}`} />}
            <span
              aria-hidden="true"
              className={`relative z-10 flex h-6 w-6 items-center justify-center rounded-full text-[11px] ${
                done ? "bg-ink text-white" : "border border-ink/25 bg-white"
              }`}
            >
              {done ? "✓" : ""}
            </span>
            <span className={`mt-2 text-[11px] leading-tight sm:text-xs ${i === active ? "font-medium text-ink" : done ? "text-ink" : "text-ink/45"}`}>
              {step.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export function ReturnReply({ reply, dateLabel }: { reply: string; dateLabel?: string | null }) {
  return (
    <div className="mt-5 border-l-2 border-ink bg-ink/[0.024] px-4 py-3">
      <p className="text-xs text-ink/60">Bollmark yanıtı{dateLabel ? ` · ${dateLabel}` : ""}</p>
      <p className="mt-1 whitespace-pre-line text-sm leading-relaxed">{reply}</p>
    </div>
  );
}

// Talep formunun ustundeki kisa bilgi. where: kodun nerede gorunecegi.
export function ReturnHowItWorks({ where }: { where: string }) {
  return (
    <div className="border border-line bg-ink/[0.024] p-4 text-sm leading-relaxed">
      <p className="font-medium">Nasıl işler?</p>
      <ul className="mt-2 list-disc space-y-1 pl-4 text-ink/75">
        <li>Teslimden itibaren {STORE_INFO.returnDays} gün içinde talep oluşturabilirsin.</li>
        <li>Ürün kullanılmamış, etiketleri sökülmemiş ve orijinal ambalajında olmalı; faturasını da ekle.</li>
        <li>
          Talebin onaylanınca {STORE_INFO.returnCarrier} anlaşmalı iade kodu ve gönderim adresi {where} ve e-postanda görünecek.
        </li>
      </ul>
    </div>
  );
}
