"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
      setError("E-posta veya sifre hatali.");
      return;
    }
    router.push("/admin");
    router.refresh();
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink px-6">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-5 bg-paper p-10">
        <div className="text-center">
          <p className="font-display text-2xl uppercase tracking-widest2">Bollmark</p>
          <p className="mt-1 text-xs uppercase tracking-wide text-ink/50">Yonetim Paneli</p>
        </div>
        <input
          name="email"
          type="email"
          required
          placeholder="E-posta"
          className="w-full border border-line px-4 py-3"
        />
        <input
          name="password"
          type="password"
          required
          placeholder="Sifre"
          className="w-full border border-line px-4 py-3"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-ink py-3 text-sm uppercase tracking-widest2 text-paper hover:bg-accent disabled:opacity-50"
        >
          {loading ? "Giris yapiliyor..." : "Giris Yap"}
        </button>
      </form>
    </div>
  );
}
