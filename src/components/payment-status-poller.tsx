"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const POLL_INTERVAL_MS = 4000;
const MAX_POLLS = 30;

// Odeme sonucu henuz netlesmediyse (callback gec geldi / dolandiricilik incelemesi) durum
// periyodik sorgulanir; `kontrol=1` sunucuyu iyzico'yu yeniden sorgulamaya iter. Durum
// degisince sayfa yenilenir (sayfa her zaman DB'deki gercek duruma gore cizilir).
export function PaymentStatusPoller({ orderNumber, initialState }: { orderNumber: string; initialState: string }) {
  const router = useRouter();
  const [gaveUp, setGaveUp] = useState(false);

  useEffect(() => {
    let polls = 0;
    let stopped = false;
    const timer = setInterval(async () => {
      polls += 1;
      try {
        const res = await fetch(`/api/odeme/durum?siparis=${encodeURIComponent(orderNumber)}&kontrol=1`, {
          cache: "no-store"
        });
        const data = await res.json();
        if (!stopped && data.state && data.state !== initialState) {
          stopped = true;
          clearInterval(timer);
          router.refresh();
          return;
        }
      } catch {
        // gecici ag hatasi: bir sonraki turda tekrar denenir
      }
      if (polls >= MAX_POLLS && !stopped) {
        stopped = true;
        clearInterval(timer);
        setGaveUp(true);
      }
    }, POLL_INTERVAL_MS);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [orderNumber, initialState, router]);

  if (!gaveUp) return null;
  return (
    <p className="mt-4 text-sm text-ink/60">
      Ödemeniz henüz doğrulanamadı. Ödeme tamamlandıysa sonuç e-posta ile bildirilecektir; sorun yaşarsanız sipariş
      numaranızla bize ulaşabilirsiniz.
    </p>
  );
}
