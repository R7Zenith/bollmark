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

  const inputClass = "w-full rounded-lg border border-line h-12 px-4 text-xs bg-transparent";
  const labelClass = "text-[10px] font-medium tracking-[1px] uppercase text-ink";
  const primaryButtonClass =
    "w-full rounded-full bg-ink text-white text-[10px] tracking-[1px] uppercase px-6 py-4 hover:bg-ink/90 disabled:opacity-50";

  return (
    <div className="flex flex-col lg:h-[calc(100vh-72px)] lg:flex-row lg:overflow-hidden lg:-mb-24">
      <div className="hidden lg:block lg:h-full lg:flex-1">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://images.unsplash.com/photo-1614283233556-f35b0c801ef1?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1200"
          alt=""
          className="h-full w-full object-cover"
        />
      </div>

      <div className="flex flex-1 items-start justify-start px-9 py-16 lg:h-full lg:overflow-y-auto lg:pl-16 lg:pt-28 lg:pb-16">
        <div className="w-full max-w-[432px]">
          <h1 className="font-display text-[47px] leading-[47px] tracking-[-1.88px] font-normal">
            {tab === "giris" ? "Tekrar hoş geldin!" : "Hoş geldin!"}
          </h1>

          <div className="mt-8 flex gap-3">
            <button
              type="button"
              onClick={() => setTab("giris")}
              className={`rounded-full px-6 py-4 text-[10px] uppercase tracking-[1px] ${
                tab === "giris" ? "bg-ink text-white" : "border border-ink text-ink bg-transparent"
              }`}
            >
              Giriş Yap
            </button>
            <button
              type="button"
              onClick={() => setTab("kayit")}
              className={`rounded-full px-6 py-4 text-[10px] uppercase tracking-[1px] ${
                tab === "kayit" ? "bg-ink text-white" : "border border-ink text-ink bg-transparent"
              }`}
            >
              Hesap Oluştur
            </button>
          </div>

          {tab === "giris" ? (
            <form onSubmit={handleLogin} className="mt-8 space-y-5">
              <div className="space-y-2">
                <label className={labelClass}>E-posta</label>
                <input name="email" type="email" required className={inputClass} />
              </div>
              <div className="space-y-2">
                <label className={labelClass}>Şifre</label>
                <input name="password" type="password" required className={inputClass} />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button type="submit" disabled={loading} className={primaryButtonClass}>
                {loading ? "İşleniyor..." : "Giriş Yap"}
              </button>
              {/* TODO: /hesap/sifremi-unuttum route'u eklendiğinde bağlanacak */}
              <a href="#" className="block text-center text-[10px] uppercase tracking-[1px] underline text-ink/60 hover:text-ink">
                Şifremi Unuttum
              </a>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="mt-8 space-y-5">
              <div className="space-y-2">
                <label className={labelClass}>Ad Soyad</label>
                <input name="name" required className={inputClass} />
              </div>
              <div className="space-y-2">
                <label className={labelClass}>E-posta</label>
                <input name="email" type="email" required className={inputClass} />
              </div>
              <div className="space-y-2">
                <label className={labelClass}>Telefon (opsiyonel)</label>
                <input name="phone" className={inputClass} />
              </div>
              <div className="space-y-2">
                <label className={labelClass}>Şifre (en az 8 karakter)</label>
                <input name="password" type="password" required minLength={8} className={inputClass} />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button type="submit" disabled={loading} className={primaryButtonClass}>
                {loading ? "İşleniyor..." : "Hesap Oluştur"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
