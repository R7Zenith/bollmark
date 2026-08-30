"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useToast } from "@/components/admin/toast";

const successMessages: Record<string, string> = {
  olusturuldu: "Ürün oluşturuldu.",
  guncellendi: "Değişiklikler kaydedildi."
};

const errorMessages: Record<string, string> = {
  kaydedilemedi: "Değişiklikler kaydedilemedi. Varyantlardan biri mevcut bir siparişe bağlı olabilir.",
  silinemedi: "Ürün silinemedi. Mevcut siparişlere bağlı olabilir.",
  "sku-tekrar": "Aynı SKU'ya sahip birden fazla varyant var. Her varyantın SKU'su tekil olmalı.",
  "varyant-tekrar": "Aynı beden/renk kombinasyonuna sahip birden fazla varyant var."
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
      showToast(errorMessages[hata] ?? "Bir hata oluştu.", "error");
      router.replace(pathname);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [basarili, hata]);

  return null;
}
