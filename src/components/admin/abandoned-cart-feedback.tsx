"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/admin/toast";

const errorMessages: Record<string, string> = {
  bulunamadi: "Sepet bulunamadı.",
  kurtarilmis: "Bu sepet zaten tamamlanmış bir siparişe dönüşmüş, hatırlatma gönderilmedi."
};

const successMessages: Record<string, string> = {
  "hatirlatma-gonderildi": "Hatırlatma e-postası gönderildi."
};

export function AbandonedCartFeedback({ basarili, hata }: { basarili?: string; hata?: string }) {
  const { showToast } = useToast();
  const router = useRouter();

  useEffect(() => {
    if (basarili && successMessages[basarili]) {
      showToast(successMessages[basarili], "success");
      router.replace("/admin/terk-edilmis-sepetler");
    } else if (hata) {
      showToast(errorMessages[hata] ?? "Bir hata oluştu.", "error");
      router.replace("/admin/terk-edilmis-sepetler");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [basarili, hata]);

  return null;
}
