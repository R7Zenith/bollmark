"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/admin/toast";

const successMessages: Record<string, string> = {
  eklendi: "Kategori eklendi.",
  guncellendi: "Kategori güncellendi.",
  silindi: "Kategori silindi."
};

const errorMessages: Record<string, string> = {
  "isim-gerekli": "Kategori adı girilmelidir.",
  "urun-bagli": "Bu kategoriye bağlı ürünler olduğu için silinemedi.",
  bulunamadi: "Kategori bulunamadı."
};

export function CategoryFeedback({ basarili, hata }: { basarili?: string; hata?: string }) {
  const { showToast } = useToast();
  const router = useRouter();

  useEffect(() => {
    if (basarili && successMessages[basarili]) {
      showToast(successMessages[basarili], "success");
      router.replace("/admin/kategoriler");
    } else if (hata) {
      showToast(errorMessages[hata] ?? "Bir hata oluştu.", "error");
      router.replace("/admin/kategoriler");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [basarili, hata]);

  return null;
}
