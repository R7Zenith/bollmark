"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/admin/toast";

const successMessages: Record<string, string> = {
  eklendi: "Kategori eklendi.",
  guncellendi: "Kategori guncellendi.",
  silindi: "Kategori silindi."
};

const errorMessages: Record<string, string> = {
  "isim-gerekli": "Kategori adi girilmelidir.",
  "urun-bagli": "Bu kategoriye bagli urunler oldugu icin silinemedi.",
  bulunamadi: "Kategori bulunamadi."
};

export function CategoryFeedback({ basarili, hata }: { basarili?: string; hata?: string }) {
  const { showToast } = useToast();
  const router = useRouter();

  useEffect(() => {
    if (basarili && successMessages[basarili]) {
      showToast(successMessages[basarili], "success");
      router.replace("/admin/kategoriler");
    } else if (hata) {
      showToast(errorMessages[hata] ?? "Bir hata olustu.", "error");
      router.replace("/admin/kategoriler");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [basarili, hata]);

  return null;
}
