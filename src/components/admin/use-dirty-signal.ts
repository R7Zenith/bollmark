"use client";

import { useEffect, useRef } from "react";

// Gizli bir <input> alaninin degeri React state'i uzerinden (butonla ekleme/silme/
// siralama gibi) degisti diginde, native bir DOM "input" olayi hic tetiklenmiyor -
// React sadece DOM value'sunu programatik olarak guncelliyor. `SaveBar` ise formun
// "input"/"change" olaylarini dinleyerek "kaydedilmemis degisiklik var" cubugunu
// gosteriyor, bu yuzden bu tur degisiklikler fark edilmiyordu. Bu hook, verilen
// deger degistiginde (ilk render haric) referanslanan input uzerinde bubbling bir
// "input" olayi tetikleyip forma haber veriyor.
export function useDirtySignal<T>(value: T) {
  const ref = useRef<HTMLInputElement>(null);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    ref.current?.dispatchEvent(new Event("input", { bubbles: true }));
  }, [value]);

  return ref;
}
