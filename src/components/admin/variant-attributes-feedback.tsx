"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/admin/toast";

const errorMessages: Record<string, string> = {
  "isim-bos": "Özellik adı boş olamaz.",
  "isim-tekrar": "Bu isimde bir özellik zaten var.",
  "deger-bos": "Değer boş olamaz.",
  "deger-tekrar": "Bu değer bu özellikte zaten var.",
  "kaydedilemedi": "Kaydedilemedi, lütfen tekrar deneyin."
};

const successMessages: Record<string, string> = {
  "ozellik-eklendi": "Özellik eklendi.",
  "ozellik-silindi": "Özellik silindi.",
  "deger-eklendi": "Değer eklendi.",
  "deger-silindi": "Değer silindi.",
  "deger-guncellendi": "Değer güncellendi.",
  "siralandi": "Sıralama güncellendi."
};

export function VariantAttributesFeedback({ basarili, hata }: { basarili?: string; hata?: string }) {
  const { showToast } = useToast();
  const router = useRouter();

  useEffect(() => {
    if (basarili && successMessages[basarili]) {
      showToast(successMessages[basarili], "success");
      router.replace("/admin/ayarlar/varyant-ozellikleri");
    } else if (hata) {
      showToast(errorMessages[hata] ?? "Bir hata oluştu.", "error");
      router.replace("/admin/ayarlar/varyant-ozellikleri");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [basarili, hata]);

  return null;
}
