"use client";

import { useState } from "react";
import Image from "next/image";
import { Poppins } from "next/font/google";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { Logo } from "@/components/admin/logo";

// Admin katmani Poppins yuklemiyor (sadece (site) layout'u yukluyor); giris
// sayfasi magazayla ayni fontu kullansin diye burada, sayfa kapsaminda yukleniyor.
const poppins = Poppins({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500"],
  display: "swap"
});

const inputClass =
  "admin-login-input block h-12 w-full border border-[#D9D5CF] bg-white px-4 text-[15px] text-[#111] outline-none rounded-none focus:border-[#111] focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-0 focus-visible:outline-[#111]";
const labelClass = "mb-2 block text-xs font-medium text-[#111]";

export default function AdminLoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
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
    router.push("/admin");
    router.refresh();
  };

  return (
    <div className={`${poppins.className} min-h-screen bg-[#FAF8F5] lg:grid lg:grid-cols-[55fr_45fr]`}>
      {/* Gorsel paneli: mobilde 160px'lik ince bant, masaustunde tam yukseklik. */}
      <div className="relative h-[160px] overflow-hidden bg-[#2a2623] lg:h-auto">
        <Image
          src="/hero-model.jpg"
          alt="bollmark"
          fill
          priority
          sizes="(min-width: 1024px) 55vw, 100vw"
          className="admin-login-image object-cover"
          style={{ objectPosition: "50% 20%" }}
        />
        <div className="absolute inset-0 hidden bg-gradient-to-t from-black/45 to-transparent lg:block" />
        <div className="absolute inset-x-12 bottom-10 hidden text-white lg:block" lang="tr">
          <p className="text-[15px] lowercase tracking-[0.25em]">Mağazanı yönet.</p>
          <div className="mt-5 border-t border-white/40 pt-3 text-[11px] lowercase tracking-[0.2em] text-white/80">
            © bollmark
          </div>
        </div>
      </div>

      {/* Form paneli */}
      <div className="flex items-center justify-center px-6 py-12">
        <div className="admin-login-form w-full max-w-[380px]">
          <div>
            <Logo variant="dark" height={30} href={null} />
            <p className="mt-4 text-[11px] uppercase tracking-[0.2em] text-[#6F6A63]">Yönetim Paneli</p>
          </div>

          <h1 className="mt-12 text-[28px] font-medium leading-tight text-[#111]">Tekrar hoş geldin</h1>
          <p className="mt-2 text-sm text-[#6F6A63]">Devam etmek için hesabınla giriş yap.</p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            {error && (
              <p role="alert" className="border-l-2 border-[#B42318] bg-[#FEF3F2] px-4 py-3 text-[13px] text-[#B42318]">
                {error}
              </p>
            )}

            <div>
              <label htmlFor="email" className={labelClass}>
                E-posta
              </label>
              <input id="email" name="email" type="email" required className={inputClass} />
            </div>

            <div>
              <label htmlFor="password" className={labelClass}>
                Şifre
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  required
                  className={`${inputClass} pr-12`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Şifreyi gizle" : "Şifreyi göster"}
                  aria-pressed={showPassword}
                  className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-[#6F6A63] hover:text-[#111] focus-visible:outline focus-visible:outline-1 focus-visible:-outline-offset-2 focus-visible:outline-[#111]"
                >
                  {showPassword ? <EyeOff size={18} strokeWidth={1.5} /> : <Eye size={18} strokeWidth={1.5} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex h-12 w-full items-center justify-center gap-3 rounded-none bg-[#111] text-[13px] uppercase tracking-[0.12em] text-white hover:bg-[#333] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#111] disabled:cursor-not-allowed disabled:bg-[#333]"
            >
              {loading && (
                <span
                  aria-hidden="true"
                  className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white"
                />
              )}
              {loading ? "Giriş yapılıyor…" : "Giriş Yap"}
            </button>
          </form>

          <p className="mt-10 text-[11px] text-[#6F6A63]">Bu alan yalnızca yetkili kullanıcılar içindir.</p>
        </div>
      </div>
    </div>
  );
}
