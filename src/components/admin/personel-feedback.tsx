"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/admin/toast";

const successMessages: Record<string, string> = {
  eklendi: "Personel eklendi.",
  guncellendi: "Personel güncellendi.",
  "durum-guncellendi": "Personel durumu güncellendi.",
  "sifre-sifirlandi": "Personel şifresi güncellendi."
};

const errorMessages: Record<string, string> = {
  "isim-gerekli": "Ad girilmelidir.",
  "eposta-gerekli": "Geçerli bir e-posta girilmelidir.",
  "sifre-kisa": "Şifre en az 8 karakter olmalıdır.",
  "eposta-kullanimda": "Bu e-posta adresi zaten kullanılıyor.",
  "kendi-kaydin": "Kendi rol/durum bilginizi değiştiremezsiniz.",
  bulunamadi: "Personel bulunamadı."
};

export function PersonelFeedback({ basarili, hata }: { basarili?: string; hata?: string }) {
  const { showToast } = useToast();
  const router = useRouter();

  useEffect(() => {
    if (basarili && successMessages[basarili]) {
      showToast(successMessages[basarili], "success");
      router.replace("/admin/personel");
    } else if (hata) {
      showToast(errorMessages[hata] ?? "Bir hata oluştu.", "error");
      router.replace("/admin/personel");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [basarili, hata]);

  return null;
}
