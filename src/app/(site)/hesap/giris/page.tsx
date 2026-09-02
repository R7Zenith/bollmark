"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function HesapGirisPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"giris" | "kayit">("giris");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const form = new FormData(e.currentTarget);

    const res = await signIn("credentials", {
      email: form.get("email"),
      password: form.get("password"),
      redirect: false
    });

    setLoading(false);
    if (res?.error) {
      setError("E-posta veya şifre hatalı.");
      return;
    }
    router.push("/hesap");
    router.refresh();
  };

  const handleRegister = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    const payload = {
      name: String(form.get("name") || ""),
      email: String(form.get("email") || ""),
      phone: String(form.get("phone") || "") || undefined,
      password: String(form.get("password") || "")
    };

    try {
      const res = await fetch("/api/musteri-kayit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Kayıt oluşturulamadı.");
        setLoading(false);
        return;
      }
      const signInRes = await signIn("credentials", {
        email: payload.email,
        password: payload.password,
        redirect: false
      });
      setLoading(false);
      if (signInRes?.error) {
        setTab("giris");
        return;
      }
      router.push("/hesap");
      router.refresh();
    } catch {
      setError("Bir sorun oluştu, lütfen tekrar deneyin.");
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-md px-6 py-16">
      <h1 className="font-display text-3xl">Hesabım</h1>

      <div className="mt-8 flex gap-6 border-b border-line text-sm uppercase tracking-wide">
        <button
          type="button"
          onClick={() => setTab("giris")}
          className={`-mb-px border-b-2 px-1 py-3 ${tab === "giris" ? "border-ink text-ink" : "border-transparent text-ink/50"}`}
        >
          Giriş Yap
        </button>
        <button
          type="button"
          onClick={() => setTab("kayit")}
          className={`-mb-px border-b-2 px-1 py-3 ${tab === "kayit" ? "border-ink text-ink" : "border-transparent text-ink/50"}`}
        >
          Hesap Oluştur
        </button>
      </div>

      {tab === "giris" ? (
        <form onSubmit={handleLogin} className="mt-8 space-y-4">
          <input name="email" type="email" required placeholder="E-posta" className="w-full border border-line px-4 py-3 text-sm" />
          <input name="password" type="password" required placeholder="Şifre" className="w-full border border-line px-4 py-3 text-sm" />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-ink py-3 text-sm uppercase tracking-widest2 text-paper hover:bg-accent disabled:opacity-50"
          >
            {loading ? "İşleniyor..." : "Giriş Yap"}
          </button>
        </form>
      ) : (
        <form onSubmit={handleRegister} className="mt-8 space-y-4">
          <input name="name" required placeholder="Ad Soyad" className="w-full border border-line px-4 py-3 text-sm" />
          <input name="email" type="email" required placeholder="E-posta" className="w-full border border-line px-4 py-3 text-sm" />
          <input name="phone" placeholder="Telefon (opsiyonel)" className="w-full border border-line px-4 py-3 text-sm" />
          <input
            name="password"
            type="password"
            required
            minLength={8}
            placeholder="Şifre (en az 8 karakter)"
            className="w-full border border-line px-4 py-3 text-sm"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-ink py-3 text-sm uppercase tracking-widest2 text-paper hover:bg-accent disabled:opacity-50"
          >
            {loading ? "İşleniyor..." : "Hesap Oluştur"}
          </button>
        </form>
      )}
    </div>
  );
}
