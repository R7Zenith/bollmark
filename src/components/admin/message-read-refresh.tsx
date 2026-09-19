"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Detay sayfasi bir "yeni" mesaji "okundu"ya cevirdiginde, layout'taki sidebar
// rozetinin (okunmamis sayisi) da guncellenmesi icin sayfayi bir kez yeniler -
// layout istemci gezinmesinde kendiliginden yeniden render edilmez.
export function MessageReadRefresh() {
  const router = useRouter();
  useEffect(() => {
    router.refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
