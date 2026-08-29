"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useToast } from "@/components/admin/toast";

const successMessages: Record<string, string> = {
  "durum-guncellendi": "Sipariş durumu güncellendi.",
  "kargo-guncellendi": "Kargo bilgileri güncellendi."
};

const errorMessages: Record<string, string> = {
  guncellenemedi: "Bir hata oluştu, güncellenemedi."
};

export function OrderFeedback({ basarili, hata }: { basarili?: string; hata?: string }) {
  const { showToast } = useToast();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (basarili && successMessages[basarili]) {
      showToast(successMessages[basarili], "success");
      router.replace(pathname);
    } else if (hata) {
      showToast(errorMessages[hata] ?? "Bir hata oluştu.", "error");
      router.replace(pathname);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [basarili, hata]);

  return null;
}
