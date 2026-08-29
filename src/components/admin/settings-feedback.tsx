"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/admin/toast";

const errorMessages: Record<string, string> = {
  "kullanici-bulunamadi": "Kullanıcı bulunamadı.",
  "mevcut-sifre-yanlis": "Mevcut şifre yanlış.",
  "sifre-kisa": "Yeni şifre en az 8 karakter olmalı.",
  "sifre-eslesmiyor": "Yeni şifreler eşleşmiyor."
};

const successMessages: Record<string, string> = {
  hesap: "Şifre başarıyla güncellendi.",
  magaza: "Mağaza bilgileri kaydedildi."
};

export function SettingsFeedback({ basarili, hata }: { basarili?: string; hata?: string }) {
  const { showToast } = useToast();
  const router = useRouter();

  useEffect(() => {
    if (basarili && successMessages[basarili]) {
      showToast(successMessages[basarili], "success");
      router.replace("/admin/ayarlar");
    } else if (hata) {
      showToast(errorMessages[hata] ?? "Bir hata oluştu.", "error");
      router.replace("/admin/ayarlar");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [basarili, hata]);

  return null;
}
