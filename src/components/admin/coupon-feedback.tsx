"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/admin/toast";

const successMessages: Record<string, string> = {
  eklendi: "Kampanya eklendi.",
  guncellendi: "Kampanya güncellendi.",
  silindi: "Kampanya silindi."
};

const errorMessages: Record<string, string> = {
  "kod-gerekli": "Kupon kodu girilmelidir.",
  "kod-tekrar": "Bu kupon kodu zaten kullanılıyor.",
  "kullanilmis": "Bu kupon en az bir siparişte kullanıldığı için silinemedi.",
  bulunamadi: "Kampanya bulunamadı."
};

export function CouponFeedback({ basarili, hata }: { basarili?: string; hata?: string }) {
  const { showToast } = useToast();
  const router = useRouter();

  useEffect(() => {
    if (basarili && successMessages[basarili]) {
      showToast(successMessages[basarili], "success");
      router.replace("/admin/kampanyalar");
    } else if (hata) {
      showToast(errorMessages[hata] ?? "Bir hata oluştu.", "error");
      router.replace("/admin/kampanyalar");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [basarili, hata]);

  return null;
}
