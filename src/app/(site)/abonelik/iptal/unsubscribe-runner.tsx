"use client";

import { useEffect, useState } from "react";

// Sayfa acilinca istemciden otomatik POST (plan 6.10). JS yoksa sayfadaki
// <noscript> formu ayni uca gider.
export function UnsubscribeRunner({ token }: { token: string }) {
  const [state, setState] = useState<"pending" | "done" | "error">("pending");

  useEffect(() => {
    fetch(`/api/abonelik/iptal?t=${encodeURIComponent(token)}`, { method: "POST" })
      .then((res) => setState(res.ok ? "done" : "error"))
      .catch(() => setState("error"));
  }, [token]);

  if (state === "pending") return <p className="mt-4 text-sm text-ink/70">İşleniyor...</p>;
  if (state === "error") return <p className="mt-4 text-sm text-red-600">Bağlantı geçersiz ya da bir sorun oluştu.</p>;
  return (
    <p className="mt-4 text-sm text-ink/70">
      Kampanya e-postalarından çıktın. Fikrini değiştirirsen Hesabım &gt; İletişim Tercihleri&apos;nden yeniden açabilirsin.
    </p>
  );
}
