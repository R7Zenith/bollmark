"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/admin/toast";

const errorMessages: Record<string, string> = {
  "kullanici-bulunamadi": "Kullanici bulunamadi.",
  "mevcut-sifre-yanlis": "Mevcut sifre yanlis.",
  "sifre-kisa": "Yeni sifre en az 8 karakter olmali.",
  "sifre-eslesmiyor": "Yeni sifreler eslesmiyor."
};

const successMessages: Record<string, string> = {
  hesap: "Sifre basariyla guncellendi.",
  magaza: "Magaza bilgileri kaydedildi."
};

export function SettingsFeedback({ basarili, hata }: { basarili?: string; hata?: string }) {
  const { showToast } = useToast();
  const router = useRouter();

  useEffect(() => {
    if (basarili && successMessages[basarili]) {
      showToast(successMessages[basarili], "success");
      router.replace("/admin/ayarlar");
    } else if (hata) {
      showToast(errorMessages[hata] ?? "Bir hata olustu.", "error");
      router.replace("/admin/ayarlar");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [basarili, hata]);

  return null;
}
