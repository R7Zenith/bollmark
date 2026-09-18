"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { SIZE_GUIDE, MAIN_CATEGORIES } from "@/lib/size-guide-data";

// Koton'daki tablonun yanindaki "Bedeninizi nasil olcmelisiniz?" kutusu -
// Boyun/Ic Boy/Bacak Boy/Ic Bacak icin gorsel/aciklama yok (bkz. plan
// dosyasi), sadece bu 4 tanim var.
const MEASURE_TIPS = [
  { label: "Göğüs", desc: "Göğsünüzün en geniş kısmından tüm göğsü çevreleyin." },
  { label: "Göğüs Altı", desc: "Göğüs çevrenizi tam göğsünüzün altından ölçün." },
  { label: "Bel", desc: "Mezurayı belinizin en ince kısmına yerleştirerek ölçün." },
  { label: "Basen", desc: "Kalçanızın en geniş kısmından ölçüm yapın." }
];

// InfoDrawer'daki sagdan cekmece deseninden FARKLI, ortalanmis/fade+scale
// ile acilan klasik bir modal - genis tablo + yan bilgi kutusu dar bir
// cekmeceye sigmadigi icin bu sekilde ayrildi (bkz.
// URUN_DETAY_IADE_BAKIM_BEDEN_TABLOSU_PLANI.md v4).
export function SizeGuideModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [mounted, setMounted] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);
  const [visible, setVisible] = useState(false);
  const [mainCategory, setMainCategory] = useState(MAIN_CATEGORIES[0]);
  const [subType, setSubType] = useState(Object.keys(SIZE_GUIDE[MAIN_CATEGORIES[0]])[0]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (open) {
      setShouldRender(true);
      document.body.style.overflow = "hidden";
    } else {
      setVisible(false);
      document.body.style.overflow = "";
      const timeout = setTimeout(() => setShouldRender(false), 250);
      return () => clearTimeout(timeout);
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    if (!shouldRender) return;
    const raf = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(raf);
  }, [shouldRender]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  const handleMainCategoryChange = (category: string) => {
    setMainCategory(category);
    setSubType(Object.keys(SIZE_GUIDE[category])[0]);
  };

  if (!shouldRender || !mounted) return null;

  const subTypes = Object.keys(SIZE_GUIDE[mainCategory]);
  const table = SIZE_GUIDE[mainCategory][subType];

  return createPortal(
    <div className="fixed inset-0 z-[800] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Kapat"
        className={`absolute inset-0 bg-black/50 transition-opacity duration-200 ${visible ? "opacity-100" : "opacity-0"}`}
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Beden Tablosu"
        className={`relative z-[801] max-h-[85vh] w-full max-w-3xl overflow-y-auto bg-cream p-6 transition-[opacity,transform] duration-200 ${
          visible ? "scale-100 opacity-100" : "scale-95 opacity-0"
        }`}
      >
        <div className="flex items-center justify-between">
          <p className="text-[21px] leading-[21px] tracking-[-0.84px]">Beden Tablosu</p>
          <button type="button" aria-label="Kapat" onClick={onClose} className="p-1">
            <X size={20} strokeWidth={1.5} />
          </button>
        </div>

        <div className="mt-5 flex flex-wrap gap-2 border-b border-line pb-4">
          {MAIN_CATEGORIES.map((category) => (
            <button
              key={category}
              type="button"
              onClick={() => handleMainCategoryChange(category)}
              className={`rounded-full border px-3 py-1.5 text-xs uppercase tracking-wide transition duration-300 ${
                mainCategory === category ? "border-ink bg-ink text-cream" : "border-line text-ink/70 hover:border-ink"
              }`}
            >
              {category}
            </button>
          ))}
        </div>

        {subTypes.length > 1 && (
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
            {subTypes.map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setSubType(st)}
                className={`border-b-2 pb-1 text-xs uppercase tracking-wide transition duration-300 ${
                  subType === st ? "border-ink text-ink" : "border-transparent text-ink/50 hover:text-ink"
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        )}

        <div className="mt-6 grid gap-6 md:grid-cols-[1fr_220px]">
          <div className="min-w-0 overflow-x-auto">
            <table className="w-full border-collapse text-xs text-ink/70">
              <thead>
                <tr>
                  {table.headers.map((h, i) => (
                    <th key={i} className="whitespace-nowrap border border-line px-2 py-1.5 text-left font-medium text-ink">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.rows.map((row, r) => (
                  <tr key={r}>
                    {row.map((cell, c) => (
                      <td key={c} className="whitespace-nowrap border border-line px-2 py-1.5">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-xs text-ink/50">
              Kumaştan dolayı ölçülerde ±2 cm sapma olabilir. Standart bedenler, mağazamızın beden ölçülerini
              yansıtır, ürünün tam boyutlarını değildir.
            </p>
          </div>
          <div className="space-y-3 text-xs text-ink/70">
            <p className="font-medium text-ink">Bedeninizi nasıl ölçmelisiniz?</p>
            {MEASURE_TIPS.map((tip) => (
              <div key={tip.label}>
                <p className="font-medium text-ink">{tip.label}</p>
                <p className="mt-0.5">{tip.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
