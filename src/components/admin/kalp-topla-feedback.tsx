"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/admin/toast";

const successMessages: Record<string, string> = {
  mod: "Kampanya modu kaydedildi.",
  degerler: "Kampanya değerleri kaydedildi.",
  "test-eklendi": "Test hesabı eklendi.",
  "test-cikarildi": "Test hesabı çıkarıldı.",
  "alan-adi-eklendi": "Alan adı engellendi.",
  "alan-adi-kaldirildi": "Alan adı listeden kaldırıldı."
};

const errorMessages: Record<string, string> = {
  mod: "Geçersiz mod seçimi.",
  deger: "Tüm değerler 1 veya daha büyük tam sayı olmalı; indirim oranı en çok 100.",
  eposta: "Müşteri e-postasını yazın.",
  "musteri-yok": "Bu e-postayla kayıtlı müşteri bulunamadı.",
  "alan-adi": "Geçerli bir alan adı yazın (ör. ornekmail.com)."
};

export function KalpToplaFeedback({ basarili, hata }: { basarili?: string; hata?: string }) {
  const { showToast } = useToast();
  const router = useRouter();

  useEffect(() => {
    if (basarili && successMessages[basarili]) {
      showToast(successMessages[basarili], "success");
      router.replace("/admin/kalp-topla");
    } else if (hata) {
      showToast(errorMessages[hata] ?? "Bir hata oluştu.", "error");
      router.replace("/admin/kalp-topla");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [basarili, hata]);

  return null;
}
