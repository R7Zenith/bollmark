"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useToast } from "@/components/admin/toast";

const successMessages: Record<string, string> = {
  guncellendi: "İade talebi güncellendi.",
  "fark-acik": "Talep tamamlandı, ancak değişim farkı henüz kapatılmadı.",
  "degisim-hesaplandi": "Değişim farkı hesaplandı.",
  "fark-kapandi": "Değişim farkı kapatıldı."
};

const errorMessages: Record<string, string> = {
  guncellenemedi: "İade talebi güncellenemedi.",
  "varyant-yok": "Bu stok koduyla ürün bulunamadı.",
  "coklu-kupon": "Bu talepte birden fazla kuponlu satır var. Her kuponlu satır için ayrı talep gerekir.",
  kapandi: "Kupon işlemi tamamlandı, değişim ürünü artık değiştirilemez.",
  bulunamadi: "Talep bulunamadı."
};

export function ReturnFeedback({ basarili, hata }: { basarili?: string; hata?: string }) {
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
