"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/admin/toast";

const successMessages: Record<string, string> = {
  ayarlar: "Sanal POS ayarları kaydedildi.",
  test: "Bağlantı testi başarılı."
};

const errorMessages: Record<string, string> = {
  taksit: "Geçersiz taksit seçimi.",
  sure: "Sipariş bekleme süresi 10 ile 1440 dakika arasında olmalı.",
  "sandbox-anahtar-oneki": "Sandbox anahtarları \"sandbox-\" ile başlamalı. Canlı anahtarı yanlış alana girmiş olabilirsiniz.",
  "canli-anahtar-oneki": "Canlı anahtarlar \"sandbox-\" ile başlamamalı. Sandbox anahtarını yanlış alana girmiş olabilirsiniz.",
  "sifreleme-anahtari-yok": "PAYMENT_ENCRYPTION_KEY tanımlı olmadığı için anahtarlar kaydedilemedi.",
  "canli-gecis-sarti":
    "Canlı moda geçmek için canlı API Key + Secret Key tanımlı olmalı ve canlı bağlantı testi başarılı olmalı. Anahtarları yeni girdiyseniz önce Test modunda kaydedip \"Canlı\" bağlantı testini çalıştırın.",
  "canli-test-sadece-production": "Canlı bağlantı testi yalnızca canlı (production) ortamında çalıştırılabilir.",
  "test-anahtar-yok": "Bu mod için anahtarlar tanımlı değil ya da çözülemedi (PAYMENT_ENCRYPTION_KEY kontrol edin).",
  "test-basarisiz": "Bağlantı testi başarısız. Ayrıntı için Durum kartına bakın."
};

export function SanalPosFeedback({ basarili, hata }: { basarili?: string; hata?: string }) {
  const { showToast } = useToast();
  const router = useRouter();

  useEffect(() => {
    if (basarili && successMessages[basarili]) {
      showToast(successMessages[basarili], "success");
      router.replace("/admin/sanal-pos");
    } else if (hata) {
      showToast(errorMessages[hata] ?? "Bir hata oluştu.", "error");
      router.replace("/admin/sanal-pos");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [basarili, hata]);

  return null;
}
