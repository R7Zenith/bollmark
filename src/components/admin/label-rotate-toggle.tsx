"use client";

import { useEffect, useState } from "react";

// Termal etiketi yazdirirken 90 derece dondurur (yalniz baski; ekran onizlemesi
// degismez). Secim bu tarayicida hatirlanir; dogru ayar yaziciya gore bir kez bulunur.
const KEY = "bm-etiket-dondur";

export function LabelRotateToggle() {
  const [on, setOn] = useState(false);

  useEffect(() => {
    try {
      setOn(localStorage.getItem(KEY) === "1");
    } catch {}
  }, []);

  useEffect(() => {
    document.querySelector(".yk-sheet")?.classList.toggle("yk-rot", on);
  }, [on]);

  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-admin-text">
      <input
        type="checkbox"
        checked={on}
        onChange={(e) => {
          setOn(e.target.checked);
          try {
            localStorage.setItem(KEY, e.target.checked ? "1" : "0");
          } catch {}
        }}
        className="h-4 w-4 rounded border-admin-border text-admin-accent focus:ring-admin-accent"
      />
      Etiketi 90° döndür
    </label>
  );
}
