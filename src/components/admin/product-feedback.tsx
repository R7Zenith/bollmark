"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useToast } from "@/components/admin/toast";

const successMessages: Record<string, string> = {
  olusturuldu: "Urun olusturuldu.",
  guncellendi: "Degisiklikler kaydedildi."
};

const errorMessages: Record<string, string> = {
  kaydedilemedi: "Degisiklikler kaydedilemedi. Varyantlardan biri mevcut bir siparise bagli olabilir.",
  silinemedi: "Urun silinemedi. Mevcut siparislere bagli olabilir."
};

export function ProductFeedback({ basarili, hata }: { basarili?: string; hata?: string }) {
  const { showToast } = useToast();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (basarili && successMessages[basarili]) {
      showToast(successMessages[basarili], "success");
      router.replace(pathname);
    } else if (hata) {
      showToast(errorMessages[hata] ?? "Bir hata olustu.", "error");
      router.replace(pathname);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [basarili, hata]);

  return null;
}
