"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/admin/toast";

const successMessages: Record<string, string> = {
  eklendi: "Bundle eklendi.",
  guncellendi: "Bundle güncellendi.",
  silindi: "Bundle silindi."
};

const errorMessages: Record<string, string> = {
  "ad-gerekli": "Bundle adı girilmelidir.",
  "urun-yetersiz": "En az 2 ürün seçilmelidir.",
  bulunamadi: "Bundle bulunamadı."
};

export function BundleFeedback({ basarili, hata }: { basarili?: string; hata?: string }) {
  const { showToast } = useToast();
  const router = useRouter();

  useEffect(() => {
    if (basarili && successMessages[basarili]) {
      showToast(successMessages[basarili], "success");
      router.replace("/admin/bundle-kampanyalari");
    } else if (hata) {
      showToast(errorMessages[hata] ?? "Bir hata oluştu.", "error");
      router.replace("/admin/bundle-kampanyalari");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [basarili, hata]);

  return null;
}
