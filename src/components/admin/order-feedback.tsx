"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useToast } from "@/components/admin/toast";

const successMessages: Record<string, string> = {
  "durum-guncellendi": "Sipariş durumu güncellendi.",
  "kargo-guncellendi": "Kargo bilgileri güncellendi.",
  "iade-yapildi": "İade yapıldı.",
  "iptal-yapildi": "Ödeme iptal edildi.",
  sorgulandi: "Ödeme durumu iyzico'dan sorgulandı.",
  "uyari-kapatildi": "Uyarı kapatıldı.",
  "kayit-sonuclandi": "Kayıt sonuçlandırıldı."
};

const errorMessages: Record<string, string> = {
  guncellenemedi: "Bir hata oluştu, güncellenemedi.",
  "iade-basarisiz": "İade yapılamadı.",
  "iptal-basarisiz": "Ödeme iptal edilemedi.",
  "sorgu-basarisiz": "iyzico sorgulanamadı, biraz sonra tekrar deneyin.",
  "odeme-kurali":
    "Ödemesi iyzico ile denenmiş siparişler elle \"Ödendi\" yapılamaz; ödemesi incelenen siparişler hazırlanamaz."
};

export function OrderFeedback({ basarili, hata, mesaj }: { basarili?: string; hata?: string; mesaj?: string }) {
  const { showToast } = useToast();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (basarili && successMessages[basarili]) {
      showToast(successMessages[basarili], "success");
      router.replace(pathname);
    } else if (hata) {
      const base = errorMessages[hata] ?? "Bir hata oluştu.";
      showToast(mesaj ? `${base} ${mesaj}` : base, "error");
      router.replace(pathname);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [basarili, hata]);

  return null;
}
