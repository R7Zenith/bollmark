"use client";

import { useState } from "react";
import { contactPrefs, contactPrefLabel } from "@/lib/status";

const inputClass = "w-full rounded-lg border border-line h-12 px-4 text-xs bg-transparent";
const labelClass = "text-[10px] font-medium tracking-[1px] uppercase text-ink";

export function ContactForm() {
  const [prefs, setPrefs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const needsPhone = prefs.includes("TELEFON") || prefs.includes("SMS");

  function togglePref(pref: string) {
    setPrefs((prev) => (prev.includes(pref) ? prev.filter((p) => p !== pref) : [...prev, pref]));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget;
    setLoading(true);
    setError(null);
    setSuccess(false);
    const form = new FormData(formEl);
    const payload = {
      firstName: String(form.get("firstName") || ""),
      lastName: String(form.get("lastName") || ""),
      email: String(form.get("email") || ""),
      phone: needsPhone ? String(form.get("phone") || "") : undefined,
      contactPrefs: prefs,
      message: String(form.get("message") || ""),
      website: String(form.get("website") || "")
    };

    try {
      const res = await fetch("/api/iletisim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(
          typeof data?.error === "string" ? data.error : "Mesajınız gönderilemedi. Lütfen daha sonra tekrar deneyin."
        );
        return;
      }
      setSuccess(true);
      setPrefs([]);
      formEl.reset();
    } catch {
      setError("Bir sorun oluştu, lütfen bağlantınızı kontrol edip tekrar deneyin.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label htmlFor="contact-firstName" className={labelClass}>
            Ad
          </label>
          <input id="contact-firstName" name="firstName" required maxLength={60} autoComplete="given-name" className={inputClass} />
        </div>
        <div className="space-y-2">
          <label htmlFor="contact-lastName" className={labelClass}>
            Soyad
          </label>
          <input id="contact-lastName" name="lastName" required maxLength={60} autoComplete="family-name" className={inputClass} />
        </div>
      </div>

      <fieldset className="space-y-3">
        <legend className={labelClass}>Size nasıl ulaşalım?</legend>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          {contactPrefs.map((pref) => (
            <label key={pref} className="flex items-center gap-2 text-xs text-ink">
              <input
                type="checkbox"
                checked={prefs.includes(pref)}
                onChange={() => togglePref(pref)}
                className="h-4 w-4 accent-ink"
              />
              {contactPrefLabel[pref]}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="space-y-2">
        <label htmlFor="contact-email" className={labelClass}>
          E-posta
        </label>
        <input id="contact-email" name="email" type="email" required maxLength={254} autoComplete="email" className={inputClass} />
      </div>

      {needsPhone && (
        <div className="space-y-2">
          <label htmlFor="contact-phone" className={labelClass}>
            Telefon
          </label>
          <input
            id="contact-phone"
            name="phone"
            type="tel"
            required
            maxLength={20}
            autoComplete="tel"
            className={inputClass}
          />
        </div>
      )}

      <div className="space-y-2">
        <label htmlFor="contact-message" className={labelClass}>
          Mesaj
        </label>
        <textarea
          id="contact-message"
          name="message"
          required
          rows={6}
          maxLength={2000}
          className="w-full rounded-lg border border-line px-4 py-3 text-xs bg-transparent"
        />
      </div>

      {/* Honeypot: gorunmez tuzak alan, gercek kullanici doldurmaz (bkz. api/iletisim). */}
      <div aria-hidden="true" className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
        <label>
          Web sitesi
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      {success && (
        <p role="status" className="text-sm text-ink">
          Mesajınız iletildi, en kısa sürede dönüş yapacağız.
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-full bg-ink text-white text-[10px] tracking-[1px] uppercase px-6 py-4 hover:bg-ink/90 disabled:opacity-50"
      >
        {loading ? "Gönderiliyor..." : "Mesaj Gönder"}
      </button>
    </form>
  );
}
