"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/admin/toast";

const successMessages: Record<string, string> = {
  eklendi: "Marka eklendi.",
  guncellendi: "Marka güncellendi.",
  silindi: "Marka silindi."
};

const errorMessages: Record<string, string> = {
  "isim-gerekli": "Marka adı girilmelidir.",
  "urun-bagli": "Bu markaya bağlı ürünler olduğu için silinemedi.",
  bulunamadi: "Marka bulunamadı."
};

export function BrandFeedback({ basarili, hata }: { basarili?: string; hata?: string }) {
  const { showToast } = useToast();
  const router = useRouter();

  useEffect(() => {
    if (basarili && successMessages[basarili]) {
      showToast(successMessages[basarili], "success");
      router.replace("/admin/markalar");
    } else if (hata) {
      showToast(errorMessages[hata] ?? "Bir hata oluştu.", "error");
      router.replace("/admin/markalar");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [basarili, hata]);

  return null;
}
