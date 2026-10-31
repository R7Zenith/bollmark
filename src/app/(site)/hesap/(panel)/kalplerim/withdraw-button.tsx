"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function WithdrawHeartButton({ productId }: { productId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const withdraw = async () => {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/kalp-topla/kalp", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId })
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(typeof data.error === "string" ? data.error : "Kalp geri çekilemedi.");
    }
    setBusy(false);
    router.refresh();
  };

  return (
    <div className="text-right">
      <button
        type="button"
        onClick={withdraw}
        disabled={busy}
        className="text-xs text-ink/60 underline underline-offset-4 hover:text-ink disabled:opacity-50"
      >
        Kalbimi geri çek
      </button>
      {error && <p className="mt-1 text-xs text-sale">{error}</p>}
    </div>
  );
}
